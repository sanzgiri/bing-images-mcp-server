import Chat from './components/Chat';
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
import ImageInfo from './components/ImageInfo';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function Home() {
  noStore();
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  const res = await fetch(`${proto}://${host}/api/bing-image?country=us&random=true`, {
    cache: 'no-store',
  });
  const image = res.ok ? await res.json() : null;

  if (!image) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Failed to load image. Please try again.</p>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-1000"
        style={{ backgroundImage: `url(${image.image_url})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col justify-between p-6 md:p-12">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight drop-shadow-lg">
              Bing Image of the Day
            </h1>
            <p className="text-white/70 text-sm mt-1">Powered by Peapix</p>
          </div>
          <a
            href="/?random=true"
            className="text-sm text-white/80 border border-white/20 rounded-full px-3 py-1.5 hover:text-white hover:border-white/40 transition"
          >
            Another image
          </a>
        </header>

        {/* Footer / Info */}
        <div className="max-w-2xl">
          <ImageInfo image={image} />
        </div>
      </div>

      {/* Chat Interface */}
      <Chat imageContext={image} />
    </main>
  );
}
