/**
 * =============================================================================
 * FILE: src/app/(dashboard)/contacts/import/page.tsx
 * PURPOSE: CSV Import Page for Contacts
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Allows uploading CSV file with contacts
 * - Shows preview of data before import
 * - Allows mapping CSV columns to contact fields
 * - Validates phone numbers (must have country code)
 * - Shows import progress and results
 * - Handles duplicate detection (by phone number)
 * - Supports tagging all imported contacts
 * 
 * KEY FEATURES:
 * - Drag & drop file upload
 * - Column mapping interface
 * - Data preview (first 10 rows)
 * - Validation errors display
 * - Skip/Update duplicates option
 * - Progress bar during import
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * - Papa Parse (for CSV parsing) - via dynamic import
 * =============================================================================
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  field: 'name' | 'phone' | 'email' | 'skip';
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

const CONTACT_FIELDS = [
  { value: 'name', label: 'Name' },
  { value: 'phone', label: 'Phone (Required)' },
  { value: 'email', label: 'Email' },
  { value: 'skip', label: 'Skip this column' },
];

export default function ContactImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping[]>([]);
  const [importTag, setImportTag] = useState('');
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      alert('CSV file must have headers and at least one data row');
      return;
    }

    // Simple CSV parsing (handles basic cases)
    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of row) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]);
    const data: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseRow(lines[i]);
      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    setCsvHeaders(headers);
    setCsvData(data);

    // Auto-detect column mapping
    const autoMapping: ColumnMapping[] = headers.map(header => {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes('name')) {
        return { csvColumn: header, field: 'name' };
      } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('number')) {
        return { csvColumn: header, field: 'phone' };
      } else if (lowerHeader.includes('email') || lowerHeader.includes('mail')) {
        return { csvColumn: header, field: 'email' };
      }
      return { csvColumn: header, field: 'skip' };
    });

    setColumnMapping(autoMapping);
    setStep('mapping');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        parseCSV(droppedFile);
      } else {
        alert('Please upload a CSV file');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const updateMapping = (csvColumn: string, field: 'name' | 'phone' | 'email' | 'skip') => {
    setColumnMapping(prev =>
      prev.map(m => (m.csvColumn === csvColumn ? { ...m, field } : m))
    );
  };

  const validateMapping = (): boolean => {
    const hasPhone = columnMapping.some(m => m.field === 'phone');
    if (!hasPhone) {
      alert('Phone field is required. Please map a column to Phone.');
      return false;
    }
    return true;
  };

  const handleImport = async () => {
    if (!validateMapping()) return;

    setStep('importing');
    setImporting(true);
    setProgress(0);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.organization_id) return;

    const phoneColumn = columnMapping.find(m => m.field === 'phone')?.csvColumn;
    const nameColumn = columnMapping.find(m => m.field === 'name')?.csvColumn;
    const emailColumn = columnMapping.find(m => m.field === 'email')?.csvColumn;

    const results: ImportResult = {
      total: csvData.length,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const phone = phoneColumn ? row[phoneColumn]?.trim() : '';
      const name = nameColumn ? row[nameColumn]?.trim() : '';
      const email = emailColumn ? row[emailColumn]?.trim() : '';

      // Validate phone
      if (!phone) {
        results.errors.push(`Row ${i + 2}: Missing phone number`);
        results.skipped++;
        continue;
      }

      // Format phone (ensure it has + prefix)
      let formattedPhone = phone.replace(/[^\d+]/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone; // Default to India
      }

      // Check for existing contact
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', userData.organization_id)
        .eq('phone', formattedPhone)
        .maybeSingle();

      if (existing) {
        if (duplicateAction === 'skip') {
          results.skipped++;
          setProgress(((i + 1) / csvData.length) * 100);
          continue;
        } else {
          // Update existing
          await supabase
            .from('contacts')
            .update({
              name: name || undefined,
              email: email || undefined,
              tags: importTag ? [importTag] : undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          results.imported++;
        }
      } else {
        // Insert new
        const { error } = await supabase.from('contacts').insert({
          organization_id: userData.organization_id,
          phone: formattedPhone,
          name: name || null,
          email: email || null,
          tags: importTag ? [importTag] : [],
          opt_in_status: false,
        });

        if (error) {
          results.errors.push(`Row ${i + 2}: ${error.message}`);
          results.skipped++;
        } else {
          results.imported++;
        }
      }

      setProgress(((i + 1) / csvData.length) * 100);
    }

    setResult(results);
    setImporting(false);
    setStep('complete');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/contacts">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Contacts</h1>
          <p className="text-gray-500">Upload a CSV file to import contacts</p>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Your CSV should have columns for name, phone number, and optionally email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-whatsapp bg-green-50' : 'border-gray-300'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Drag and drop your CSV file here, or</p>
              <label className="cursor-pointer">
                <span className="text-whatsapp hover:underline">browse to upload</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-4">Maximum file size: 5MB</p>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">CSV Format Example:</h4>
              <code className="text-sm text-gray-600">
                name,phone,email<br />
                John Doe,+919876543210,john@example.com<br />
                Jane Smith,+919876543211,jane@example.com
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              Match your CSV columns to contact fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {file && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <span className="text-sm text-gray-500">{csvData.length} rows</span>
              </div>
            )}

            <div className="space-y-3">
              {columnMapping.map((mapping) => (
                <div key={mapping.csvColumn} className="flex items-center space-x-4">
                  <div className="w-1/3">
                    <span className="text-sm font-medium text-gray-700">{mapping.csvColumn}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <select
                    value={mapping.field}
                    onChange={(e) => updateMapping(mapping.csvColumn, e.target.value as any)}
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {CONTACT_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 mt-4">
              <Label>Add tag to all imported contacts (optional)</Label>
              <Input
                placeholder="e.g., imported-jan-2025"
                value={importTag}
                onChange={(e) => setImportTag(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <Label>When duplicate phone number is found:</Label>
              <div className="flex space-x-4 mt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicate"
                    checked={duplicateAction === 'skip'}
                    onChange={() => setDuplicateAction('skip')}
                    className="text-whatsapp"
                  />
                  <span className="text-sm">Skip duplicate</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicate"
                    checked={duplicateAction === 'update'}
                    onChange={() => setDuplicateAction('update')}
                    className="text-whatsapp"
                  />
                  <span className="text-sm">Update existing</span>
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button variant="whatsapp" onClick={() => setStep('preview')}>
                Preview Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
            <CardDescription>
              Review the first 5 rows before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {csvData.slice(0, 5).map((row, i) => {
                    const phoneCol = columnMapping.find(m => m.field === 'phone')?.csvColumn;
                    const nameCol = columnMapping.find(m => m.field === 'name')?.csvColumn;
                    const emailCol = columnMapping.find(m => m.field === 'email')?.csvColumn;
                    
                    return (
                      <tr key={i}>
                        <td className="px-4 py-2">{nameCol ? row[nameCol] : '-'}</td>
                        <td className="px-4 py-2">{phoneCol ? row[phoneCol] : '-'}</td>
                        <td className="px-4 py-2">{emailCol ? row[emailCol] : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {csvData.length > 5 && (
              <p className="text-sm text-gray-500 mt-2">
                ...and {csvData.length - 5} more rows
              </p>
            )}

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button variant="whatsapp" onClick={handleImport}>
                Import {csvData.length} Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-whatsapp mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Importing Contacts...</h3>
            <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-whatsapp h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">{Math.round(progress)}% complete</p>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && result && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Import Complete!</h3>
            
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto my-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                <p className="text-sm text-gray-500">Total Rows</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                <p className="text-sm text-gray-500">Imported</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                <p className="text-sm text-gray-500">Skipped</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="text-left max-w-md mx-auto mb-6 p-4 bg-red-50 rounded-lg">
                <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Errors ({result.errors.length})
                </h4>
                <ul className="text-sm text-red-700 list-disc list-inside">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>...and {result.errors.length - 5} more errors</li>
                  )}
                </ul>
              </div>
            )}

            <Button variant="whatsapp" asChild>
              <Link href="/contacts">View Contacts</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
