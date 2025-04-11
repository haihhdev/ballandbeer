import AboutUs from "@/components/aboutus";
import Gallery from "@/components/gallery";
import UserFetcher from "@/components/userFetcher";

export default function Home() {
  return (
    <div>
      {/* About Us Section */}
      <AboutUs />
      {/* Gallery Section */}
      <Gallery />
      <UserFetcher />
    </div>
  );
}
