import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Sesuaikan path

const SetorKlasis = () => {
  const [bulanPilih, setBulanPilih] = useState('');
  const [arsipData, setArsipData] = useState(null);
  const [loading, setLoading] = useState(false);

  // State untuk jumlah lembar/keping uang fisik
  const [uangFisik, setUangFisik] = useState({
    100000: '', 50000: '', 20000: '', 10000: '', 
    5000: '', 2000: '', 1000: '', 500: ''
  });

  const [catatan, setCatatan] = useState('');

  // Menarik Arsip yang sudah dibuat di TarikDataSetoran.jsx
  const handleCariArsip = async (e) => {
    e.preventDefault();
    if (!bulanPilih) return alert('Pilih bulan terlebih dahulu.');

    setLoading(true);
    setArsipData(null);
    
    try {
      const docRef = doc(db, 'arsip_setoran', bulanPilih);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setArsipData(data);
        // Jika sebelumnya sudah pernah disimpan/disahkan, muat datanya
        if (data.rekonsiliasi_fisik) {
          setUangFisik(data.rekonsiliasi_fisik.rincian_lembaran);
          setCatatan(data.rekonsiliasi_fisik.catatan || '');
        } else {
          // Reset form jika belum ada
          setUangFisik({ 100000: '', 50000: '', 20000: '', 10000: '', 5000: '', 2000: '', 1000: '', 500: '' });
          setCatatan('');
        }
      } else {
        alert('Data arsip bulan ini belum dibuat. Silakan selesaikan proses di menu "Tarik Data" terlebih dahulu.');
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat mencari arsip.');
    } finally {
      setLoading(false);
    }
  };

  // Menangani perubahan input lembaran uang
  const handleUangChange = (pecahan, value) => {
    // Hanya izinkan angka
    const validValue = value.replace(/[^0-9]/g, '');
    setUangFisik(prev => ({ ...prev, [pecahan]: validValue }));
  };

  // Menghitung Total Uang Fisik secara real-time
  const totalFisik = useMemo(() => {
    return Object.keys(uangFisik).reduce((total, pecahan) => {
      const jumlah = Number(uangFisik[pecahan] || 0);
      return total + (Number(pecahan) * jumlah);
    }, 0);
  }, [uangFisik]);

  const targetSetoran = arsipData?.total_pengeluaran || 0;
  const selisih = totalFisik - targetSetoran;

  // Menyimpan hasil rekonsiliasi ke dalam arsip yang sama
  const handleSimpanRekonsiliasi = async () => {
    if (selisih !== 0) {
      const konfirmasi = window.confirm(`Peringatan: Terdapat selisih ${formatRupiah(selisih)}.\nApakah Anda yakin ingin menyimpan arsip dengan status TIDAK BALANCE?`);
      if (!konfirmasi) return;
    }

    setLoading(true);
    try {
      const docRef = doc(db, 'arsip_setoran', bulanPilih);
      await updateDoc(docRef, {
        rekonsiliasi_fisik: {
          rincian_lembaran: uangFisik,
          total_fisik: totalFisik,
          selisih: selisih,
          catatan: catatan,
          waktu_disahkan: new Date().toISOString(),
          status: selisih === 0 ? 'Balance' : 'Selisih'
        }
      });
      
      // Update state lokal agar UI langsung berubah
      setArsipData(prev => ({
        ...prev,
        rekonsiliasi_fisik: { total_fisik: totalFisik, selisih: selisih, status: selisih === 0 ? 'Balance' : 'Selisih' }
      }));
      
      alert('Rekonsiliasi fisik berhasil diarsipkan! Data siap dicetak ke Kwitansi.');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan rekonsiliasi ke arsip.');
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

  const formatBulan = (formatYYYYMM) => {
    if (!formatYYYYMM) return '';
    const [y, m] = formatYYYYMM.split('-');
    return new Date(y, parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen animate-fade-in relative">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800">Kalkulator Setor Klasis</h1>
          <p className="text-slate-500 mt-1">Verifikasi kecocokan antara uang fisik di laci dengan arsip setoran sistem.</p>
          
          <form onSubmit={handleCariArsip} className="mt-6 flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/2">
              <label className="block text-sm font-medium mb-1 text-slate-700">Bulan Basis Penerimaan</label>
              <input 
                type="month" 
                required 
                value={bulanPilih} 
                onChange={(e) => setBulanPilih(e.target.value)} 
                className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <button type="submit" disabled={loading} className="w-full md:w-1/4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition">
              {loading ? 'Mencari...' : 'Buka Arsip'}
            </button>
          </form>
        </div>

        {arsipData && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* PANEL KIRI: INFO SISTEM & HASIL */}
            <div className="md:col-span-5 space-y-6">
              {/* Target Box */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Data Arsip Sistem</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500">Basis Penerimaan</p>
                    <p className="font-semibold">{formatBulan(arsipData.bulan_penerimaan)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Bulan Setoran</p>
                    <p className="font-semibold">{formatBulan(arsipData.bulan_setoran)}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm font-bold text-slate-700 mb-1">Target Disetorkan (Pengeluaran)</p>
                    <p className="text-3xl font-black text-red-600">{formatRupiah(targetSetoran)}</p>
                  </div>
                </div>
              </div>

              {/* Status Box */}
              <div className={`rounded-lg shadow-sm border p-6 transition-colors duration-300 ${selisih === 0 && totalFisik > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Hasil Rekonsiliasi</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-1">Total Uang Fisik</p>
                    <p className="text-2xl font-bold text-slate-900">{formatRupiah(totalFisik)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-1">Status Keseimbangan</p>
                    {totalFisik === 0 ? (
                      <span className="text-slate-400 font-medium">Belum dihitung</span>
                    ) : selisih === 0 ? (
                      <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                        BALANCE
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                        SELISIH: {formatRupiah(Math.abs(selisih))} {selisih > 0 ? '(LEBIH)' : '(KURANG)'}
                      </div>
                    )}
                  </div>
                </div>

                {arsipData.rekonsiliasi_fisik?.status && (
                  <div className="mt-6 p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800 font-medium">
                    Arsip ini telah disahkan pada: <br/> 
                    {new Date(arsipData.rekonsiliasi_fisik.waktu_disahkan).toLocaleString('id-ID')}
                  </div>
                )}
              </div>
            </div>

            {/* PANEL KANAN: KALKULATOR PECAHAN */}
            <div className="md:col-span-7 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-3 mb-4">Rincian Pecahan Uang</h3>
              
              <div className="space-y-3 mb-6">
                {/* Looping dari pecahan besar ke kecil */}
                {[100000, 50000, 20000, 10000, 5000, 2000, 1000, 500].map((pecahan) => (
                  <div key={pecahan} className="flex items-center gap-4">
                    <div className="w-32 text-right font-semibold text-slate-700">
                      {formatRupiah(pecahan)}
                    </div>
                    <div className="text-slate-400 font-bold">x</div>
                    <input
                      type="text"
                      placeholder="0"
                      value={uangFisik[pecahan]}
                      onChange={(e) => handleUangChange(pecahan, e.target.value)}
                      className="w-20 border border-slate-300 rounded text-center py-1.5 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                    <div className="text-slate-400 font-bold text-sm">lembar/keping</div>
                    <div className="flex-1 text-right font-bold text-slate-800">
                      {formatRupiah(Number(uangFisik[pecahan] || 0) * pecahan)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows="2"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Misal: Penjelasan jika ada selisih uang atau kondisi fisik uang."
                  className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <button
                onClick={handleSimpanRekonsiliasi}
                disabled={loading || totalFisik === 0}
                className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all ${totalFisik === 0 ? 'bg-slate-300' : selisih === 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {loading ? 'Menyimpan Arsip...' : 'Kunci & Sahkan Rekonsiliasi'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default SetorKlasis;