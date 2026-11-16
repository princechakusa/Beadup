import { LandingArticle, landingMetadata } from "@/components/site/LandingArticle";

export const metadata = landingMetadata("booking-link-with-deposits");

export default function Page() {
  return <LandingArticle slug="booking-link-with-deposits" />;
}
