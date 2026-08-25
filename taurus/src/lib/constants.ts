// Post types
export const POST_TYPE_LABELS: Record<string, string> = {
  NEWS: "Новость",
  WORK: "Работа",
  UPDATE: "Обновление",
  EVENT: "Событие",
  PROMO: "Акция",
};

export const POST_TYPE_COLORS: Record<string, string> = {
  NEWS: "bg-blue-500/20 text-blue-400",
  WORK: "bg-emerald-500/20 text-emerald-400",
  UPDATE: "bg-amber-500/20 text-amber-400",
  EVENT: "bg-purple-500/20 text-purple-400",
  PROMO: "bg-red-500/20 text-red-400",
};

// Post statuses
export const POST_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "В архиве",
};

export const POST_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-700 text-slate-200",
  PENDING: "bg-yellow-900/50 text-yellow-300",
  PUBLISHED: "bg-green-900/50 text-green-300",
  ARCHIVED: "bg-slate-800 text-slate-400",
};

// User roles
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Супер-админ",
  ADMIN: "Администратор",
  EDITOR: "Редактор",
  SPECIALIST: "Специалист",
  USER: "Пользователь",
};

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-amber-900/50 text-amber-300",
  ADMIN: "bg-purple-900/50 text-purple-300",
  EDITOR: "bg-blue-900/50 text-blue-300",
  SPECIALIST: "bg-cyan-900/50 text-cyan-300",
  USER: "bg-slate-700 text-slate-200",
};

// Booking statuses
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  PROCESSING: "В обработке",
  DONE: "Выполнено",
  CANCELLED: "Отменено",
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-yellow-900/50 text-yellow-300",
  PROCESSING: "bg-blue-900/50 text-blue-300",
  DONE: "bg-green-900/50 text-green-300",
  CANCELLED: "bg-slate-700 text-slate-400",
};

// Review sources
export const REVIEW_SOURCE_LABELS: Record<string, string> = {
  manual: "Ручное",
  yandex: "Яндекс",
  google: "Google",
  "2gis": "2ГИС",
};

// Audit actions
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: "Вход",
  LOGOUT: "Выход",
  CREATE: "Создание",
  UPDATE: "Обновление",
  DELETE: "Удаление",
  UPLOAD: "Загрузка",
  PAGE_VIEW: "Просмотр",
};

export const AUDIT_ACTION_COLORS: Record<string, string> = {
  LOGIN: "text-green-400",
  LOGOUT: "text-slate-400",
  CREATE: "text-blue-400",
  UPDATE: "text-amber-400",
  DELETE: "text-red-400",
  UPLOAD: "text-purple-400",
  PAGE_VIEW: "text-slate-500",
};

// Audit entities
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  auth: "Авторизация",
  post: "Публикация",
  review: "Отзыв",
  booking: "Заявка",
  user: "Пользователь",
  pageSection: "Секция страницы",
  file: "Файл",
  page: "Страница",
};

// Common CSS classes
export const INPUT_CLASS =
  "w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none";

export const LABEL_CLASS = "block mb-1 text-sm text-slate-400";

// Image processing defaults
export const IMAGE_MAX_WIDTH = 1920;
export const IMAGE_MAX_HEIGHT = 1080;
export const IMAGE_QUALITY = 80;
export const IMAGE_REDUCE_PERCENT = 30;

// Pagination
export const POSTS_PER_PAGE = 9;
export const AUDIT_PER_PAGE = 20;

// UI
export const SCROLL_THRESHOLD = 400;
export const SAVED_MESSAGE_TIMEOUT = 3000;

// Phone validation
export const PHONE_REGEX = /^\+7\d{10}$/;
export const PHONE_ERROR = "Некорректный номер телефона";

// S3
export const S3_REGION_DEFAULT = "ru-central1";
