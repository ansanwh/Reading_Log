type SiteLogoProps = {
  showText?: boolean;
};

export function SiteLogo({ showText = false }: SiteLogoProps) {
  return (
    <a className="site-logo" href={sitePath("main/")} aria-label="메인 페이지로 이동">
      <span className="site-logo-mark" aria-hidden="true">
        <img className="site-logo-image" src={sitePath("site-logo-book.png")} alt="" width={42} height={42} />
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
