import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  name: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => (
          <li key={step.id} className={cn('flex-1', index !== steps.length - 1 && 'pr-8')}>
            <div className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                    step.id < currentStep
                      ? 'border-whatsapp bg-whatsapp text-white'
                      : step.id === currentStep
                      ? 'border-whatsapp text-whatsapp'
                      : 'border-gray-300 text-gray-400'
                  )}
                >
                  {step.id < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </div>
                <div className="mt-2 text-center hidden md:block">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      step.id <= currentStep ? 'text-whatsapp' : 'text-gray-500'
                    )}
                  >
                    {step.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                </div>
              </div>
              
              {/* Connector line */}
              {index !== steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-4',
                    step.id < currentStep ? 'bg-whatsapp' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          </li>
        ))}
      </ol>
      
      {/* Mobile step name */}
      <div className="mt-4 text-center md:hidden">
        <p className="text-sm font-medium text-whatsapp">
          Step {currentStep}: {steps[currentStep - 1]?.name}
        </p>
        <p className="text-xs text-gray-500">{steps[currentStep - 1]?.description}</p>
      </div>
    </nav>
  );
}
