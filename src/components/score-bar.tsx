/**
 * 10 格分數條，前 score 格以主色填滿。
 * 面試結果頁與首頁的範例預覽共用，不含互動，Server / Client Component 都能使用。
 */
export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex gap-1" role="img" aria-label={`${score} / 10 分`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < score ? "bg-accent" : "bg-line"}`}
        />
      ))}
    </div>
  );
}
