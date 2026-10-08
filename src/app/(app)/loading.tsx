/** Esqueleto exibido enquanto uma página interna carrega. */
export default function Loading() {
  return (
    <div aria-busy="true" role="status" aria-label="Carregando">
      <div className="skeleton mb-2 h-8 w-64" />
      <div className="skeleton mb-6 h-4 w-96 max-w-full" />
      <div className="skeleton mb-4 h-14 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas estáticas do esqueleto
          <div key={i} className="skeleton h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
