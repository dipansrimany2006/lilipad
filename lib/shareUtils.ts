/**
 * Utility functions for sharing content to X (Twitter)
 */

interface ShareToXOptions {
  text: string;
  url?: string;
  hashtags?: string[];
}

/**
 * Generate a Twitter/X share intent URL
 */
export function generateXShareUrl(options: ShareToXOptions): string {
  const { text, url, hashtags } = options;

  const params = new URLSearchParams();
  params.set("text", text);

  if (url) {
    params.set("url", url);
  }

  if (hashtags && hashtags.length > 0) {
    params.set("hashtags", hashtags.join(","));
  }

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Open X share dialog in a new window
 */
export function shareToX(options: ShareToXOptions): void {
  const shareUrl = generateXShareUrl(options);
  window.open(
    shareUrl,
    "twitter-share",
    "width=550,height=450,resizable=yes,scrollbars=yes"
  );
}

/**
 * Generate share text for a newly created project
 */
export function generateProjectShareText(projectName: string, projectId?: string): ShareToXOptions {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const projectUrl = projectId ? `${baseUrl}/project/${projectId}` : baseUrl;

  return {
    text: `I just published "${projectName}" on @LilipadLaunch! Check out my new project on the Aptos blockchain.`,
    url: projectUrl,
    hashtags: ["Aptos", "Web3", "Lilipad", "Blockchain"],
  };
}

/**
 * Generate share text for a newly created fair launch
 */
export function generateFairLaunchShareText(
  projectName: string,
  tokenSymbol: string,
  saleId?: number
): ShareToXOptions {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const launchUrl = `${baseUrl}/launch`;

  return {
    text: `I just launched a Fair Launch for "${projectName}" ($${tokenSymbol}) on @LilipadLaunch! Join the token sale on Aptos.`,
    url: launchUrl,
    hashtags: ["Aptos", "FairLaunch", "TokenSale", "Lilipad", "DeFi"],
  };
}
