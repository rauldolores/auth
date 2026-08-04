import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "kontrolia:permission";

/** Marks a route as requiring one of KontrolIA's permission keys — read by KontroliaAuthGuard. */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
