import { Verse8Ads } from '@verse8/ads';

let adBusy = false;

type AdCallback = (rewarded: boolean) => void;

export async function showRewardAd(placementId: string, onResult: AdCallback) {
  if (adBusy) return;
  adBusy = true;

  try {
    const result = await Verse8Ads.showRewarded({ placementId });

    switch (result.status) {
      case 'rewarded':
        onResult(true);
        break;
      case 'dismissed':
        onResult(false);
        break;
      case 'failed':
        if (result.error.code === 'unsupported_env') {
          hideAdUI(placementId);
        }
        onResult(false);
        break;
    }
  } catch {
    onResult(false);
  } finally {
    adBusy = false;
  }
}

export function isAdBusy() {
  return adBusy;
}

function hideAdUI(placementId: string) {
  if (placementId === 'region-double-reward') {
    document.querySelector<HTMLElement>('#region-ad-double')?.classList.add('hidden');
  }
  if (placementId === 'gem-reward-30') {
    const btn = document.querySelector<HTMLButtonElement>('#buy-gem-ad');
    if (btn) btn.style.display = 'none';
  }
}
