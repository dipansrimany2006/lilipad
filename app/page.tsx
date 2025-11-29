import Navbar from "@/components/navbar";
import { Sidebar } from "lucide-react";
import { Poppins } from 'next/font/google'

const poppins = Poppins({ weight: ['400', '700'], subsets: ['latin'] })
export default function Home() {
  return (
    <div className={`relative h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
      <Navbar />
    </div>
  );
}