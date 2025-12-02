import { useMemo } from 'react';

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

interface PasswordRequirement {
  label: string;
  met: boolean;
}

interface PasswordStrengthResult {
  score: number;
  level: 'weak' | 'medium' | 'strong';
  requirements: PasswordRequirement[];
}

/**
 * Password strength indicator with visual feedback and requirements checklist
 * @param password - Password to evaluate
 * @param showRequirements - Show detailed requirements checklist
 */
export function PasswordStrength({ password, showRequirements = true }: PasswordStrengthProps) {
  const strength = useMemo((): PasswordStrengthResult => {
    const requirements: PasswordRequirement[] = [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
      { label: 'Contains number', met: /\d/.test(password) },
      { label: 'Contains special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];

    const metCount = requirements.filter(req => req.met).length;
    const score = (metCount / requirements.length) * 100;

    let level: 'weak' | 'medium' | 'strong';
    if (score < 40) {
      level = 'weak';
    } else if (score < 80) {
      level = 'medium';
    } else {
      level = 'strong';
    }

    return { score, level, requirements };
  }, [password]);

  if (!password) return null;

  const colors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  };

  const textColors = {
    weak: 'text-red-700',
    medium: 'text-yellow-700',
    strong: 'text-green-700',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${colors[strength.level]} transition-all duration-300`}
            style={{ width: `${strength.score}%` }}
            role="progressbar"
            aria-valuenow={strength.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Password strength"
          />
        </div>
        <span className={`text-sm font-medium ${textColors[strength.level]} capitalize min-w-[60px]`}>
          {strength.level}
        </span>
      </div>

      {showRequirements && (
        <div className="space-y-1">
          {strength.requirements.map((req, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <span className={req.met ? 'text-green-600' : 'text-gray-400'}>
                {req.met ? '✓' : '○'}
              </span>
              <span className={req.met ? 'text-gray-700 line-through' : 'text-gray-600'}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
