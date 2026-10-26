/** Cloudflare / bot-challenge detection for dsh-browser. */

// Must match the Remote Chromium build (zenika alpine-chrome:124). Lying about
// Chrome/131 while the binary is 124 is a classic Turnstile fingerprint fail.
const CHROME_UA =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CF_PATTERNS = [
	/just a moment/i,
	/cf-browser-verification/i,
	/challenge-platform/i,
	/cdn-cgi\/challenge/i,
	/attention required! \| cloudflare/i,
	/enable javascript and cookies to continue/i,
	/checking your browser before accessing/i,
	/turnstile/i,
	/_cf_chl/i,
	/verify you are human/i,
	/performing security verification/i,
];

/**
 * @param {number} status
 * @param {string} htmlOrText
 */
function isCloudflareChallenge(status, htmlOrText) {
	const body = String(htmlOrText || "");
	if (!body) return status === 403 || status === 503;
	const hit = CF_PATTERNS.some((re) => re.test(body));
	if (!hit) return false;
	// Real app pages can mention Cloudflare in CSP; require challenge-ish status or title.
	if (status === 403 || status === 503) return true;
	if (/<title[^>]*>\s*just a moment/i.test(body)) return true;
	if (/challenge-platform|cf-browser-verification|cdn-cgi\/challenge|_cf_chl|verify you are human/i.test(body)) return true;
	return false;
}

/**
 * Guidance when CF is detected — solve the challenge, do not abort the turn.
 * @param {string} url
 */
function cloudflareChallengeMessage(url) {
	const u = String(url || "").trim() || "this URL";
	return (
		`Cloudflare human-check is showing for ${u}. ` +
		`Do NOT give up, do NOT curl, and do NOT browser_navigate again to the same URL (that resets Turnstile). ` +
		`Stay on Remote Chromium: (1) ask the user to click “Verify you are human” in the live feed, ` +
		`and/or (2) browser_snapshot + browser_click the checkbox if listed, (3) wait, snapshot again, continue. ` +
		`If it stays on a spinner with no checkbox after ~20s, tell the user to open the URL in their normal browser — then stop.`
	);
}

/** @deprecated use cloudflareChallengeMessage — kept name for call sites that threw errors */
function cloudflareErrorMessage(url) {
	return cloudflareChallengeMessage(url);
}

/**
 * Soft tool result (ok:true, NOT done:true) so the agent keeps working the challenge.
 * @param {string} url
 */
function cloudflareDone(url) {
	const u = String(url || "").trim() || "this URL";
	return {
		cloudflareChallenge: true,
		message: cloudflareChallengeMessage(u),
	};
}

export {
	CHROME_UA,
	isCloudflareChallenge,
	cloudflareErrorMessage,
	cloudflareChallengeMessage,
	cloudflareDone,
};
