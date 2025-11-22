interface SuccessDisplayProps {
  message: string | null;
  onDismiss?: () => void;
}

export default function SuccessDisplay({ message, onDismiss }: SuccessDisplayProps) {
  if (!message) return null;

  return (
    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 flex justify-between items-start">
      <div className="flex items-start gap-3">
        <span className="text-xl">✓</span>
        <div>
          <div className="font-semibold mb-1">Success</div>
          <div className="text-sm">{message}</div>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-green-500/60 hover:text-green-500 transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}

