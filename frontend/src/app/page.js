import AboutUs from "@/components/aboutus";
import Gallery from "@/components/gallery";
import UserFetcher from "@/components/userFetcher";
import AboutUs2 from "@/components/aboutus2";
import AboutUs3 from "@/components/aboutus3";
import Minichatbot from "@/components/minichatbot";
export default function Home() {
  return (
    <div>
      <AboutUs />
      <Gallery />
      <AboutUs2 />
      <AboutUs3 />
      <Minichatbot />
      <UserFetcher />
    </div>
  );
}
