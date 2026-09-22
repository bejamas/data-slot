export const POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export const TOAST_TYPES = [
  "default",
  "success",
  "error",
  "warning",
  "info",
  "loading",
] as const;

export type ToastPosition = (typeof POSITIONS)[number];
export type ToastType = (typeof TOAST_TYPES)[number];

export interface ToastActionEvent {
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

export interface ToastAction {
  label: string;
  /** Call `event.preventDefault()` to keep the toast open after the action. */
  onClick?: (event: ToastActionEvent) => void;
  value?: string;
}

export interface ToastShowOptions {
  id?: string;
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
  closeButtonAriaLabel?: string;
  testId?: string;
}

/** Fields an update may remove by passing `null`. */
export type ToastClearableField = "description" | "action" | "closeButtonAriaLabel" | "testId";

/**
 * Partial patch for an existing toast. A missing or `undefined` field is left
 * unchanged; `null` clears a clearable field.
 */
export type ToastUpdateOptions = {
  [K in keyof Omit<ToastShowOptions, "id">]?: K extends ToastClearableField
    ? ToastShowOptions[K] | null
    : ToastShowOptions[K];
};

export interface ToastPromiseState extends ToastUpdateOptions {
  /** Alias for `title`. */
  message?: string;
}

export type ToastPromiseStateValue<T> =
  | string
  | ToastPromiseState
  | ((value: T) => string | ToastPromiseState);

export type ToastPromiseErrorValue =
  | string
  | ToastPromiseState
  | ((error: unknown) => string | ToastPromiseState);

export interface ToastPromiseOptions<T> {
  loading: string | ToastPromiseState;
  success?: ToastPromiseStateValue<T>;
  error?: ToastPromiseErrorValue;
  description?: string;
}

export interface ToastPromiseHandle<T> {
  id: string;
  unwrap(): Promise<T>;
}

export interface ToastOptions {
  limit?: number;
  duration?: number;
  position?: ToastPosition;
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  portal?: boolean;
  onShow?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAction?: (id: string, value: string | undefined) => void;
}

export interface ToastController {
  show(options: ToastShowOptions): string;
  update(id: string, patch: ToastUpdateOptions): void;
  promise<T>(
    input: Promise<T> | (() => Promise<T>),
    options: ToastPromiseOptions<T>,
  ): ToastPromiseHandle<T>;
  dismiss(id: string): void;
  dismissAll(): void;
  readonly count: number;
  destroy(): void;
}

export interface ResolvedToast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
  dismissible: boolean;
  closeButtonAriaLabel?: string;
  testId?: string;
}
