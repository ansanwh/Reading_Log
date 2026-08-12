type SiteLogoProps = {
  showText?: boolean;
};

export function SiteLogo({ showText = false }: SiteLogoProps) {
  return (
    <a className="site-logo" href={sitePath("main/")} aria-label="메인 페이지로 이동">
      <span className="logo-mark" aria-hidden="true">
        <span />
      </span>
      {showText ? (
        <div className="brand">
          <strong>Reading Log</strong>
          <span>나만의 독서기록장</span>
        </div>
      ) : null}
    </a>
  );
}
import { sitePath } from "@/lib/site-path";
