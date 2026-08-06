import type {
  Category,
  Comment,
  Municipality,
  Notification,
  Profile,
  Report,
  ReportImage,
  ReportStatus,
  Role,
  StatusHistory,
  User,
} from "@prisma/client";

/** Public-safe author shape — never carries email or password hash. */
export type PublicAuthor = Pick<User, "id" | "name" | "username" | "image">;

export type ReportListItem = Report & {
  category: Pick<Category, "id" | "name" | "slug" | "icon" | "color">;
  municipality: Pick<Municipality, "id" | "name" | "slug">;
  createdBy: PublicAuthor;
  images: Pick<ReportImage, "id" | "url" | "thumbnailUrl" | "caption">[];
  /** Populated only for signed-in viewers. */
  viewerVote?: "UPVOTE" | "DOWNVOTE" | null;
  viewerFollows?: boolean;
};

// `Omit` rather than `&`: intersecting the two `images` shapes would produce an
// unusable type that satisfies neither the list nor the detail selection.
export type ReportDetail = Omit<ReportListItem, "images"> & {
  images: ReportImage[];
  statusHistory: (StatusHistory & { changedBy: PublicAuthor })[];
  duplicateOf: Pick<Report, "id" | "title" | "slug"> | null;
};

export type CommentNode = Comment & {
  user: PublicAuthor & { role?: Pick<Role, "name"> };
  likedByViewer: boolean;
  replies: CommentNode[];
};

export type NotificationItem = Notification & {
  actor: PublicAuthor | null;
  report: Pick<Report, "id" | "slug" | "title"> | null;
};

export type ProfileWithUser = Profile & {
  user: PublicAuthor & {
    createdAt: Date;
    role: Pick<Role, "name" | "label">;
    municipality: Pick<Municipality, "id" | "name" | "slug"> | null;
  };
};

export type MapMarker = {
  id: string;
  slug: string;
  title: string;
  latitude: number;
  longitude: number;
  status: ReportStatus;
  categoryColor: string;
  categoryIcon: string;
  categoryName: string;
  municipalityName: string;
  score: number;
  createdAt: string;
  thumbnailUrl: string | null;
};

/** Uniform return shape for every Server Action. */
export type ActionResult<T = undefined> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
};

export type DashboardStats = {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  rejected: number;
  avgResolutionHours: number | null;
  resolutionRate: number;
  newThisWeek: number;
};

export type CategoryBreakdown = {
  name: string;
  color: string;
  count: number;
};

export type TrendPoint = {
  date: string;
  created: number;
  completed: number;
};

/**
 * A coordinate chosen in the report composer's map picker.
 *
 * Declared here rather than beside the picker component so consumers never need
 * to import from a Leaflet-backed module — even for a type. A stray value
 * import from there pulls Leaflet into a server-rendered bundle.
 */
export type PickedLocation = { lat: number; lng: number };
