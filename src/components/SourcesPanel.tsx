'use client';

export type Source = {
  id: string;
  index: number;
  title: string;
  origin: string;
  snippet: string;
};

interface SourcesPanelProps {
  sources: Source[];
  selectedSourceId: string | null;
  onSelectSource: (id: string) => void;
  onClose: () => void;
}

export default function SourcesPanel({
  sources,
  selectedSourceId,
  onSelectSource,
  onClose,
}: SourcesPanelProps) {
  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  return (
    <div className="hidden lg:flex w-[440px] shrink-0 flex-col border-l border-border bg-bg-card overflow-y-auto">
      {/* Selected Sources */}
      <div className="p-3 border-b border-border">
        <div className="border border-border-green rounded-md p-3">
          <h3 className="text-foreground text-[12px] font-semibold mb-1">
            SELECTED SOURCES (TOP {sources.length})
          </h3>
          <p className="text-text-secondary text-[10px] mb-3">
            Click source cards or inline citations [1][2][3] to inspect full text
          </p>
          <div className="flex flex-col gap-1.5">
            {sources.length === 0 && (
              <p className="text-muted text-[10px] italic">No sources yet — ask a question</p>
            )}
            {sources.map((source) => {
              const active = source.id === selectedSourceId;
              return (
                <button
                  key={source.id}
                  onClick={() => onSelectSource(source.id)}
                  className={`text-left text-[11px] font-semibold transition-colors ${
                    active ? 'text-green' : 'text-foreground hover:text-green'
                  }`}
                >
                  [{source.index}] {source.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Article Viewer */}
      <div className="flex-1 p-3 flex flex-col">
        <div className="border border-border-green rounded-md p-3 flex-1 flex flex-col gap-2">
          <h3 className="text-foreground text-[12px] font-semibold">WIKIPEDIA ARTICLE VIEWER</h3>

          {!selectedSource ? (
            <p className="text-muted text-[10px]">Select a source to inspect the full reference</p>
          ) : (
            <>
              {/* Article header */}
              <div className="bg-bg-card-hover rounded px-2.5 py-2 flex flex-col gap-1">
                <span className="text-green text-[10px]">Loading article...</span>
                <span className="text-foreground text-[11px] font-semibold">
                  [{selectedSource.index}] {selectedSource.title}
                </span>
                <span className="text-text-secondary text-[10px]">{selectedSource.origin}</span>
              </div>

              {/* Article body */}
              <p className="text-foreground text-[11px] leading-relaxed flex-1">
                {selectedSource.snippet}
              </p>

              {/* Navigation */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => onClose()}
                  className="text-green text-[10px] font-semibold hover:text-green-bright transition-colors"
                >
                  Back to sources
                </button>
                <button
                  onClick={() => onClose()}
                  className="text-green text-[10px] font-semibold hover:text-green-bright transition-colors"
                >
                  Close
                </button>
              </div>

              {/* Error state placeholder */}
              <p className="text-[#FF6B61] text-[10px] font-semibold hidden">Could not open article</p>

              <p className="text-text-secondary text-[10px] mt-1">
                Mobile behavior: opening a citation launches this article in a sheet/full-screen panel.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
