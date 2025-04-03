import AboutUs from "@/components/aboutus";
import Gallery from "@/components/gallery";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div>
      {/* About Us Section */}
      <AboutUs />

      {/* Gallery Section */}
      <Gallery />

      {/* Footer Section */}
      <Footer />
    </div>
  );
}
