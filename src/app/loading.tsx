export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--oracle-bg)]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl oracle-gradient-bg oracle-glow">
          <span className="text-4xl">⚡</span>
        </div>
        <div className="oracle-spinner">
          <div className="oracle-spinner-ring" />
          <span className="oracle-spinner-text">LOADING ORACLE</span>
        </div>
      </div>
    </div>
  );
}
