import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { useState } from 'react';

// Komponen yang SUDAH ADA di folder src/components/
import ManajemenTransaksi from './components/ManajemenTransaksi';
import LaporanBulanan from './components/LaporanBulanan';
import SetorKlasis from './components/SetorKlasis';
import CetakDokumen from './components/CetakDokumen';
import Konfigurasi from './components/Konfigurasi';

// Komponen BACKLOG (Buka komentar di bawah ini SATU PER SATU setelah Anda membuat file .jsx nya)
import BukuKasUmum from './components/BukuKasUmum';
import BukuPenerimaan from './components/BukuPenerimaan';
import BukuPengeluaran from './components/BukuPengeluaran';
import LaporanSidang from './components/LaporanSidang';
import RekapSidang from './components/RekapSidang';
import TarikDataSetoran from './components/TarikDataSetoran';
import KontribusiJemaat from './components/KontribusiJemaat';
import KontribusiKlasis from './components/KontribusiKlasis';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // State Login Form
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // State Menu & Navigasi
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState(null);
  const [activeView, setActiveView] = useState('input'); // Default view setelah login

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginForm.username, loginForm.password);
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '' });
      setActiveView('input');
    } catch (error) {
      alert('Email atau sandi salah! Pastikan Anda sudah mendaftarkannya di Firebase.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setIsMenuOpen(false);
    setOpenSubMenu(null);
  };

  const toggleSubMenu = (menuName) => {
    setOpenSubMenu(openSubMenu === menuName ? null : menuName);
  };

  const navigateTo = (view) => {
    setActiveView(view);
    setIsMenuOpen(false);
  };

  // Komponen Placeholder untuk menu yang belum dibangun detailnya
  const PlaceholderView = ({ title, desc }) => (
    <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center animate-fade-in">
      <h2 className="text-xl font-bold text-slate-800 mb-2">{title}</h2>
      <p className="text-slate-500">{desc}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-4 px-4 print:p-0 print:bg-white">
      
      {/* Header Utama */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6 relative print:hidden">
        <div className="flex items-center gap-3">
          {/* Ikon Logo GMIT */}
          <div className="hidden sm:block">
            <img 
              src="/logo-gmit.png" 
              alt="Logo GMIT" 
              className="w-12 h-12 md:w-14 md:h-14 object-contain drop-shadow-sm" 
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-900 leading-tight">Keuangan Jemaat</h1>
            <p className="text-sm font-semibold text-slate-500">Jemaat Koa 1</p>
          </div>
        </div>
        
        {!isLoggedIn ? (
          <button onClick={() => setShowLoginModal(true)} className="bg-blue-800 text-white px-5 py-2 font-bold rounded-md shadow hover:bg-blue-900 transition-colors">
            Login
          </button>
        ) : (
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
        )}

        {/* SISTEM NAVIGASI DROPDOWN (RESPONSIF MOBILE) */}
        {isLoggedIn && isMenuOpen && (
          <div className="absolute right-0 top-16 w-64 bg-white border border-slate-200 rounded-md shadow-xl z-20 overflow-hidden max-h-[80vh] overflow-y-auto">
            
            <button onClick={() => navigateTo('input')} className={`w-full text-left px-4 py-3 font-bold border-b transition-colors ${activeView === 'input' ? 'text-blue-800 bg-blue-50' : 'text-slate-800 hover:bg-slate-50'}`}>
              Input Transaksi
            </button>

            {/* Menu 2: Buku Administrasi */}
            <div className="border-b">
              <button onClick={() => toggleSubMenu('buku')} className="w-full text-left px-4 py-3 font-bold text-slate-800 hover:bg-slate-50 flex justify-between items-center">
                <span>Buku Administrasi</span>
                <span className="text-xs">{openSubMenu === 'buku' ? '▲' : '▼'}</span>
              </button>
              {openSubMenu === 'buku' && (
                <div className="bg-slate-50 pl-8 flex flex-col text-sm border-t border-slate-100">
                  <button onClick={() => navigateTo('buku-kas')} className={`text-left py-2 ${activeView === 'buku-kas' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Kas Umum</button>
                  <button onClick={() => navigateTo('buku-terima')} className={`text-left py-2 ${activeView === 'buku-terima' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Penerimaan</button>
                  <button onClick={() => navigateTo('buku-keluar')} className={`text-left py-2 ${activeView === 'buku-keluar' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Pengeluaran</button>
                  <button onClick={() => navigateTo('buku-lap-bulanan')} className={`text-left py-2 ${activeView === 'buku-lap-bulanan' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Laporan Bulanan</button>
                  <button onClick={() => navigateTo('buku-lap-sidang')} className={`text-left py-2 ${activeView === 'buku-lap-sidang' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Laporan Sidang</button>
                  <button onClick={() => navigateTo('buku-rekap-sidang')} className={`text-left py-2 ${activeView === 'buku-rekap-sidang' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Rekap Sidang</button>
                </div>
              )}
            </div>

            {/* Menu 3: Ke Klasis */}
            <div className="border-b">
              <button onClick={() => toggleSubMenu('klasis')} className="w-full text-left px-4 py-3 font-bold text-slate-800 hover:bg-slate-50 flex justify-between items-center">
                <span>Ke Klasis</span>
                <span className="text-xs">{openSubMenu === 'klasis' ? '▲' : '▼'}</span>
              </button>
              {openSubMenu === 'klasis' && (
                <div className="bg-slate-50 pl-8 flex flex-col text-sm border-t border-slate-100">
                  <button onClick={() => navigateTo('klasis-tarik')} className={`text-left py-2 ${activeView === 'klasis-tarik' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Tarik Data Setoran</button>
                  <button onClick={() => navigateTo('klasis-kalkulator')} className={`text-left py-2 ${activeView === 'klasis-kalkulator' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Kalkulator Setor Klasis</button>
                  <button onClick={() => navigateTo('klasis-kwitansi')} className={`text-left py-2 ${activeView === 'klasis-kwitansi' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Cetak Kwitansi</button>
                </div>
              )}
            </div>

            {/* Menu 4: Kontribusi */}
            <div className="border-b">
              <button onClick={() => toggleSubMenu('kontribusi')} className="w-full text-left px-4 py-3 font-bold text-slate-800 hover:bg-slate-50 flex justify-between items-center">
                <span>Kontribusi</span>
                <span className="text-xs">{openSubMenu === 'kontribusi' ? '▲' : '▼'}</span>
              </button>
              {openSubMenu === 'kontribusi' && (
                <div className="bg-slate-50 pl-8 flex flex-col text-sm border-t border-slate-100">
                  <button onClick={() => navigateTo('kontribusi-jemaat')} className={`text-left py-2 ${activeView === 'kontribusi-jemaat' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Kontribusi Jemaat/Wilayah</button>
                  <button onClick={() => navigateTo('kontribusi-klasis')} className={`text-left py-2 ${activeView === 'kontribusi-klasis' ? 'font-bold text-blue-800' : 'hover:text-blue-700'}`}>Kontribusi Klasis</button>
                </div>
              )}
            </div>

            <button onClick={() => navigateTo('konfigurasi')} className={`w-full text-left px-4 py-3 font-bold border-b transition-colors ${activeView === 'konfigurasi' ? 'text-blue-800 bg-blue-50' : 'text-slate-800 hover:bg-slate-50'}`}>
              Pengaturan Sistem
            </button>
            <button onClick={handleLogout} className="w-full text-left px-4 py-3 font-bold text-red-600 hover:bg-red-50">
              Keluar
            </button>
          </div>
        )}
      </div>

      {/* AREA KONTEN & ROUTING TAMPILAN */}
      <div className="w-full max-w-4xl">
        {!isLoggedIn ? (
          /* Tampilan Mode Terbatas (Belum Login) */
          <div className="bg-gradient-to-br from-blue-900 to-slate-800 p-10 rounded-2xl shadow-xl text-center border-4 border-white">
            <div className="bg-white/10 w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 backdrop-blur-sm border border-white/20">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-wide">Akses Terbatas</h2>
            <p className="text-blue-200 mb-8 max-w-md mx-auto">
              Sistem Informasi Manajemen Keuangan Jemaat Koa 1. Silakan login sebagai administrator untuk mengelola transaksi, mencetak laporan, dan menarik data klasis.
            </p>
            <button onClick={() => setShowLoginModal(true)} className="bg-white text-blue-900 px-8 py-3 rounded-full font-bold shadow-lg hover:bg-slate-100 transition-transform transform hover:scale-105">
              Masuk ke Sistem
            </button>
          </div>
        ) : (
          /* Area Tampilan Konten Ter-autentikasi */
          <>
            {activeView === 'input' && <ManajemenTransaksi />}
            {activeView === 'buku-lap-bulanan' && <LaporanBulanan />}
            {activeView === 'klasis-kalkulator' && <SetorKlasis />}
            {activeView === 'klasis-kwitansi' && <CetakDokumen />}
            {activeView === 'konfigurasi' && <Konfigurasi />}
            
            {/* Routing Placeholder View (Akan diganti komponen asli setelah file fisiknya dibuat) */}
            {activeView === 'buku-kas' && <BukuKasUmum />}
            {activeView === 'buku-terima' && <BukuPenerimaan />}
            {activeView === 'buku-keluar' && <BukuPengeluaran />}
            {activeView === 'buku-lap-sidang' && <LaporanSidang />}
            {activeView === 'buku-rekap-sidang' && <RekapSidang />}
            {activeView === 'klasis-tarik' && <TarikDataSetoran />}
            {activeView === 'kontribusi-jemaat' && <KontribusiJemaat />}
            {activeView === 'kontribusi-klasis' && <KontribusiKlasis />}
          </>
        )}
      </div>

      {/* MODAL LOGIN ADMIN */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleLoginSubmit} className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 animate-fade-in">
            <h3 className="font-bold text-2xl text-slate-800 mb-6 text-center">Login Admin</h3>
            
            <div className="flex flex-col gap-4 mb-6">
              <input 
                type="text" 
                placeholder="Username" 
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                className="w-full p-3 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                required
              />
              <input 
                type="password" 
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full p-3 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                required
              />
            </div>
            
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowLoginModal(false)} className="w-1/3 py-3 text-slate-600 font-semibold hover:bg-slate-100 rounded transition-colors">
                Batal
              </button>
              <button type="submit" className="w-2/3 py-3 bg-blue-800 text-white font-bold rounded hover:bg-blue-900 transition-colors shadow-md">
                Masuk
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

export default App;