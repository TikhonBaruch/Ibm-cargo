import Link from "next/link";
import Image from "next/image";

interface Specialist {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  specialization: string | null;
  experience: number | null;
  _count?: { posts: number };
}

export function SpecialistCard({ specialist }: { specialist: Specialist }) {
  return (
    <Link
      href={`/specialists/${specialist.id}`}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-brand-gray/20 transition hover:bg-brand-gray/30"
    >
      {/* Avatar */}
      <div className="relative aspect-square overflow-hidden bg-brand-dark">
        {specialist.image ? (
          <Image
            src={specialist.image}
            alt={specialist.name || "Специалист"}
            fill
            className="object-cover transition group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-brand-red/20">
            <span className="text-4xl font-bold text-brand-red">
              {(specialist.name || "?")[0].toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white group-hover:text-brand-red transition">
          {specialist.name || "Без имени"}
        </h3>
        {specialist.specialization && (
          <p className="mt-1 text-xs text-brand-muted">
            {specialist.specialization}
          </p>
        )}
        {specialist.experience && (
          <p className="mt-1 text-[11px] text-white/40">
            Стаж: {specialist.experience} {specialist.experience === 1 ? "год" : specialist.experience < 5 ? "года" : "лет"}
          </p>
        )}
        {specialist._count?.posts && (
          <p className="mt-1 text-[11px] text-white/40">
            {specialist._count.posts} {specialist._count.posts === 1 ? "публикация" : specialist._count.posts < 5 ? "публикации" : "публикаций"}
          </p>
        )}
      </div>
    </Link>
  );
}
