import crypto from "crypto"

/**
 * Generates a nonce string for use in Content Security Policy
 */
export function getNonce(): string {
	return crypto.randomBytes(32).toString("base64url")
}
