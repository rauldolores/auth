"use client";

import { useKontroliaAuthContext } from "./context.js";

/**
 * The single hook every consuming app uses to talk to KontrolIA Auth.
 * Mirrors the @kontrolia/auth client 1:1 plus the current reactive state,
 * so components never need to import @kontrolia/auth or supabase-js
 * directly.
 */
export function useAuth() {
  const { client, checker, ...state } = useKontroliaAuthContext();

  return {
    ...state,
    login: client.login.bind(client),
    loginWithOAuth: client.loginWithOAuth.bind(client),
    logout: client.logout.bind(client),
    register: client.register.bind(client),
    refresh: client.refresh.bind(client),
    requestPasswordReset: client.requestPasswordReset.bind(client),
    updatePassword: client.updatePassword.bind(client),
    updateProfile: client.updateProfile.bind(client),
    switchOrganization: client.switchOrganization.bind(client),
    buildOAuthServerAuthorizeUrl: client.buildOAuthServerAuthorizeUrl.bind(client),
    exchangeOAuthServerCode: client.exchangeOAuthServerCode.bind(client),
    getOAuthAuthorizationDetails: client.getOAuthAuthorizationDetails.bind(client),
    decideOAuthAuthorization: client.decideOAuthAuthorization.bind(client),
    getToken: client.getToken.bind(client),
    enrollMfa: client.enrollMfa.bind(client),
    verifyMfaEnrollment: client.verifyMfaEnrollment.bind(client),
    challengeMfa: client.challengeMfa.bind(client),
    verifyMfaChallenge: client.verifyMfaChallenge.bind(client),
    listMfaFactors: client.listMfaFactors.bind(client),
    unenrollMfa: client.unenrollMfa.bind(client),
    getAuthenticatorAssuranceLevel: client.getAuthenticatorAssuranceLevel.bind(client),
    hasPermission: checker.hasPermission,
    hasRole: checker.hasRole,
  };
}
