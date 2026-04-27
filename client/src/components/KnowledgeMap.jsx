import React from 'react';

function getDepthScore(item) {
  if (item.recall_level >= 4) return 5;
  if (item.recall_level >= 1) return 4;
  if (item.reflection) return 3;
  if (item.note_count > 0 || item.pause_point_count > 0) return 2;
  if (item.status === 'done' || item.status === 'done_quick') return 1;
  return 0;
}

export default function KnowledgeMap({ space }) {
  if (!space || !space.stages) return null;

  return (
    <div>
      <div className="flex gap-8 overflow-x-auto pb-8 pt-4">
        {space.stages.map(stage => (
          <div key={stage.id} className="flex flex-col gap-3 min-w-[60px]">
            <h3 className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1 truncate" title={stage.name}>
              {stage.name}
            </h3>
            <div className="flex flex-wrap gap-1.5 w-[80px]">
              {stage.items?.map(item => {
                const depth = getDepthScore(item);
                
                let bg = 'bg-zinc-200 dark:bg-zinc-800'; // 0: unread
                if (depth === 1) bg = 'bg-zinc-300 dark:bg-zinc-700'; // 1: read
                if (depth === 2) bg = 'bg-zinc-400 dark:bg-zinc-600'; // 2: notes
                if (depth === 3) bg = 'bg-zinc-600 dark:bg-zinc-400'; // 3: reflection
                if (depth === 4) bg = 'bg-zinc-800 dark:bg-zinc-200'; // 4: some recall
                if (depth === 5) bg = 'bg-black dark:bg-white ring-1 ring-zinc-500/30'; // 5: consolidated

                return (
                  <div 
                    key={item.id} 
                    className={`w-5 h-5 rounded-sm ${bg} transition-colors`}
                    title={`${item.title} (Depth: ${depth})`}
                  />
                );
              })}
              {(!stage.items || stage.items.length === 0) && (
                <div className="w-5 h-5 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-sm opacity-50" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 text-[10px] uppercase tracking-widest text-zinc-500">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-800"></div> Unread</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-zinc-300 dark:bg-zinc-700"></div> Read</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-zinc-400 dark:bg-zinc-600"></div> Annotated</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-zinc-600 dark:bg-zinc-400"></div> Reflected</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-zinc-800 dark:bg-zinc-200"></div> Practiced</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-black dark:bg-white ring-1 ring-zinc-500/30"></div> Consolidated</div>
      </div>
    </div>
  );
}
