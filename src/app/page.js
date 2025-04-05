import AboutUs from "@/components/aboutus";
import Gallery from "@/components/gallery";
import Contact from "@/components/contact";

export default function Home() {
  return (
    <div>
      {/* About Us Section */}
      <AboutUs />
      {/* Contact Section */}
      <Contact />
      {/* Gallery Section */}
      <Gallery />
    </div>
  );
}
