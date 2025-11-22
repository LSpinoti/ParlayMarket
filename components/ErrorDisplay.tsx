interface ErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
}

export default function ErrorDisplay({ error, onDismiss }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 flex justify-between items-start">
      <div className="flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <div className="font-semibold mb-1">Error</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-500/60 hover:text-red-500 transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}

