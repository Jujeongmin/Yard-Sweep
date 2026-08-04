import { Verse8Ads } from '@verse8/ads';

let adBusy = false;

// 광고 결과를 문서(docs.verse8.io/ko/docs/ads/intro)의 status 3분기 그대로 전달한다.
// - rewarded  : requestId를 서버 검증에 넘겨야 실제 지급
// - dismissed : 유저가 중간에 닫음 → "끝까지 시청" 안내
// - failed    : 광고를 띄우지 못함 → 유저 탓하는 문구를 쓰면 안 됨
export type AdOutcome =
  | { status: 'rewarded'; requestId: string }
  | { status: 'dismissed' }
  | { status: 'failed'; code: 'busy' | 'timeout' | 'unsupported_env' | 'platform_error' };

type AdCallback = (outcome: AdOutcome) => void;

export async function showRewardAd(placementId: string, onResult: AdCallback) {
  // SDK는 한 번에 하나의 광고만 띄운다.
  if (adBusy) {
    onResult({ status: 'failed', code: 'busy' });
    return;
  }
  adBusy = true;

  try {
    const result = await Verse8Ads.showRewarded({ placementId });

    switch (result.status) {
      case 'rewarded':
        // result.reward.amount는 UX 힌트일 뿐이므로 지급량으로 쓰지 않는다.
        onResult({ status: 'rewarded', requestId: result.requestId });
        break;
      case 'dismissed':
        onResult({ status: 'dismissed' });
        break;
      case 'failed':
        if (result.error.code === 'unsupported_env') hideAdUI(placementId);
        onResult({ status: 'failed', code: result.error.code });
        break;
    }
  } catch {
    onResult({ status: 'failed', code: 'platform_error' });
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
