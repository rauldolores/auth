import type { VerifiedRequest } from "@kontrolia/auth/server";
import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { KontroliaAuthGuard } from "./kontrolia-auth.guard.js";
import { RequirePermission } from "./require-permission.decorator.js";

@Controller("api")
export class AppController {
  @Get("facturas")
  @UseGuards(KontroliaAuthGuard)
  @RequirePermission("facturacion.facturas.crear")
  getFacturas(@Req() request: Request & { kontrolia?: VerifiedRequest }) {
    return {
      ok: true,
      message: `Autorizado — usuario ${request.kontrolia?.claims.sub} tiene facturacion.facturas.crear`,
    };
  }
}
