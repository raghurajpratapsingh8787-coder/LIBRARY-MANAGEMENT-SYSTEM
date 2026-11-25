import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { fetchAuthorizedImageBlobUrl } from '../services/api';

interface BookCoverProps {
  src?: string;
  title: string;
  className?: string;
}

export function BookCover({ src, title, className = 'w-12 h-16' }: BookCoverProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    setErrored(false);

    if (!src) {
      setResolvedUrl('');
      return;
    }

    if (src.startsWith('/api/uploads/covers/')) {
      fetchAuthorizedImageBlobUrl(src)
        .then((url) => {
          objectUrl = url;
          setResolvedUrl(url);
        })
        .catch(() => setErrored(true));
    } else {
      setResolvedUrl(src);
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!resolvedUrl || errored) {
    return (
      <div
        className={`${className} rounded-md bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 border border-slate-700/60 flex flex-col items-center justify-center p-1.5 text-center shrink-0 select-none overflow-hidden`}
      >
        <BookOpen className="w-4 h-4 text-slate-300 mb-0.5 shrink-0" />
        <span className="text-[9px] leading-tight text-slate-200 font-medium line-clamp-2">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={`Cover for ${title}`}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={`${className} rounded-md object-cover border border-slate-200 dark:border-slate-800 shrink-0`}
    />
  );
}
