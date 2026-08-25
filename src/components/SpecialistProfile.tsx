import Image from "next/image";
import { Calendar, MapPin, Briefcase } from "lucide-react";

interface SpecialistProfileProps {
  name: string | null;
  image: string | null;
  bio: string | null;
  specialization: string | null;
  phone: string | null;
  experience: number | null;
  postCount?: number;
}

export function SpecialistProfile({
  name,
  image,
  bio,
  specialization,
  phone,
  experience,
  postCount,
}: SpecialistProfileProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-brand-gray/20 p-6">
      {/* Avatar */}
      <div className="mb-6 flex items-center gap-6">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-brand-dark">
          {image ? (
            <Image
              src={image}
              alt={name || "Специалист"}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-brand-red/20">
              <span className="text-3xl font-bold text-brand-red">
                {(name || "?")[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">
            {name || "Без имени"}
          </h1>
          {specialization && (
            <p className="mt-1 text-sm text-brand-muted">{specialization}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/40">
            {experience && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                Стаж: {experience} {experience === 1 ? "год" : experience < 5 ? "года" : "лет"}
              </span>
            )}
            {postCount !== undefined && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {postCount} {postCount === 1 ? "публикация" : postCount < 5 ? "публикации" : "публикаций"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {bio && (
        <div className="border-t border-white/10 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-white">О специалисте</h2>
          <p className="whitespace-pre-wrap text-sm text-brand-muted leading-relaxed">
            {bio}
          </p>
        </div>
      )}

      {/* Contact */}
      {phone && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Контакты</h2>
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-2 text-sm text-brand-muted hover:text-white transition"
          >
            {phone}
          </a>
        </div>
      )}
    </div>
  );
}
