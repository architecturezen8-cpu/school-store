import { useEffect, useState } from "react";
import { CartProvider } from "./context/CartContext";
import { useRouter } from "./lib/router";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SearchOverlay from "./components/SearchOverlay";
import CartDrawer from "./components/CartDrawer";
import TrackOrderModal from "./components/TrackOrderModal";
import Hero from "./components/Hero";
import Categories from "./components/Categories";
import Featured from "./components/Featured";
import Motto from "./components/Motto";
import Reviews from "./components/Reviews";
import ShopPage from "./pages/ShopPage";
import ProductPage from "./pages/ProductPage";
import TicketsPage from "./pages/TicketsPage";

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const { route } = useRouter();

  // footer "Track my order" opens the modal via a plain hash anchor.
  // Listens to hashchange directly — the router deliberately ignores
  // non-route hashes, so it would never re-render on its own.
  useEffect(() => {
    const check = () => {
      if (window.location.hash === "#track") {
        setTrackOpen(true);
        history.replaceState(null, "", window.location.pathname);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  return (
    <CartProvider>
      <div className="relative min-h-screen overflow-x-clip bg-ink font-sans text-white">
        <div className="pointer-events-none fixed inset-0" aria-hidden>
          <div className="absolute left-1/2 top-[-18%] h-[70vh] w-[130vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(20,36,86,0.35),transparent)]" />
          <div className="absolute right-[-12%] top-[46%] h-[50vh] w-[46vw] rounded-full bg-[radial-gradient(closest-side,rgba(30,48,96,0.35),transparent)]" />
          <div className="absolute left-[-12%] top-[78%] h-[50vh] w-[46vw] rounded-full bg-[radial-gradient(closest-side,rgba(20,36,86,0.3),transparent)]" />
        </div>

        <div className="grain-overlay" aria-hidden />

        <Navbar
          onSearch={() => setSearchOpen(true)}
          onTrack={() => setTrackOpen(true)}
          active={route.name}
        />

        <main>
          {route.name === "home" && (
            <>
              <Hero />
              <Categories />
              <Featured />
              <Motto />
              <Reviews />
            </>
          )}

          {route.name === "shop" && (
            <ShopPage
              category={route.category}
              onSearch={() => setSearchOpen(true)}
            />
          )}

          {route.name === "product" && <ProductPage slug={route.slug} />}

          {route.name === "tickets" && <TicketsPage />}
        </main>

        <Footer />

        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
        <CartDrawer />
        <TrackOrderModal open={trackOpen} onClose={() => setTrackOpen(false)} />
      </div>
    </CartProvider>
  );
}
