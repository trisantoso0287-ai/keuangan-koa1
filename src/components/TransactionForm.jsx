import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebaseConfig'; 

const TransactionForm = ({ onClose, initialData }) => {
  // 1. State Form Input
  const [formData, setFormData] = useState({
    jenis: 'pendapatan',
    tanggal: new Date().toISOString().split('T')[0],
    jemaat: '',
    kategori: '',
    nominal: '',
    keterangan: ''
  });

  // 2. State untuk menampung Data MA dari Firestore
  const [daftarMA, setDaftarMA] = useState({
    pendapatan: [],
    pengeluaran: []
  });

  // 3. Efek saat Mode Edit (Menerima data dari tabel)
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  // 4. Efek menarik Mata Anggaran dari Firestore secara Real-Time
  useEffect(() => {
    const q = query(collection(db, "mata_anggaran"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let penda = [];
      let penge = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.kategori === 'pendapatan') {
          penda.push(data);
        } else if (data.kategori === 'pengeluaran') {
          penge.push(data);
        }
      });

      // Urutkan A-Z (Dengan pengaman)
      penda.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
      penge.sort((a, b) => (a.id || "").localeCompare(b.id || ""));

      setDaftarMA({ pendapatan: penda, pengeluaran: penge });
    });

    return () => unsubscribe();
  }, []);

  // 5. Handler Perubahan Input Standar
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Jika jemaat diubah, reset kategori agar user terpaksa memilih ulang MA yang sesuai jemaat
    if (name === 'jemaat') {
      setFormData({ ...formData, [name]: value, kategori: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Handler Khusus untuk Radio Button Jenis (Penerimaan / Pengeluaran)
  const handleJenisChange = (e) => {
    const jenisBaru = e.target.value;
    setFormData({ 
      ...formData, 
      jenis: jenisBaru,
      // Kosongkan jemaat jika pindah ke pengeluaran
      jemaat: jenisBaru === 'pengeluaran' ? '' : formData.jemaat, 
      // Reset kategori setiap ganti jenis agar tidak salah tersimpan
      kategori: '' 
    });
  };

  // Fungsi untuk memformat angka menjadi format ribuan (150.000)
  const formatRibuan = (angka) => {
    if (!angka) return '';
    return Number(angka).toLocaleString('id-ID');
  };

  // Handler khusus untuk input nominal (membersihkan titik saat diketik)
  const handleNominalChange = (e) => {
    // Hanya izinkan angka, buang semua huruf/simbol/titik
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    setFormData({ ...formData, nominal: rawValue });
  };

  // 6. Submit Data ke Firestore (Tambah atau Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasi Keamanan Input
    if (formData.jenis === 'pendapatan' && !formData.jemaat) return alert("Pilih Mata Jemaat terlebih dahulu!");
    if (!formData.kategori) return alert("Mata Anggaran (Kategori) wajib dipilih!");
    if (!formData.nominal || formData.nominal <= 0) return alert("Nominal tidak boleh kosong atau minus!");

    const dataKirim = {
      ...formData,
      nominal: Number(formData.nominal), 
      // PERBAIKAN: Gunakan waktu lama jika sedang Edit, gunakan waktu baru jika Tambah Data
      waktuUpdate: initialData?.waktuUpdate ? initialData.waktuUpdate : new Date()
    };

    try {
      if (initialData && initialData.id) {
        // MODE EDIT: Perbarui dokumen yang sudah ada
        const docRef = doc(db, "transaksi", initialData.id);
        await updateDoc(docRef, dataKirim);
        // Tampilkan pesan sukses ringan (opsional: bisa dihapus jika dirasa mengganggu)
        // alert("Perubahan transaksi berhasil disimpan!");
      } else {
        // MODE TAMBAH BARU: Buat dokumen baru
        await addDoc(collection(db, "transaksi"), dataKirim);
        // alert("Transaksi baru berhasil ditambahkan!");
      }
      onClose(); // Tutup form setelah berhasil
    } catch (error) {
      console.error("Error simpan transaksi: ", error);
      alert("Gagal menyimpan transaksi. Cek koneksi Anda.");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-lg shadow-xl flex flex-col max-h-[95vh] overflow-y-auto animate-fade-in">
        <div className="p-4 border-b flex justify-between items-center bg-blue-50 rounded-t-lg">
          <h3 className="font-bold text-lg text-blue-900">
            {initialData ? "Edit Transaksi" : "Input Transaksi Baru"}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-red-500 font-bold text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          
          {/* OPSI JENIS TRANSAKSI */}
          <div className="flex gap-4 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="jenis" value="pendapatan" checked={formData.jenis === 'pendapatan'} onChange={handleJenisChange} className="w-4 h-4 text-blue-600"/>
              <span className="font-semibold text-slate-700">Penerimaan</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="jenis" value="pengeluaran" checked={formData.jenis === 'pengeluaran'} onChange={handleJenisChange} className="w-4 h-4 text-red-600"/>
              <span className="font-semibold text-slate-700">Pengeluaran</span>
            </label>
          </div>

          <hr className="border-slate-100" />

          {/* BARIS TANGGAL */}
          <div className="flex flex-col">
            <label className="text-sm font-bold text-slate-700 mb-1">Tanggal Transaksi</label>
            <input type="date" name="tanggal" value={formData.tanggal} onChange={handleChange} className="p-2 border rounded bg-slate-50 cursor-pointer" required />
          </div>

          {/* BARIS JEMAAT (HANYA TAMPIL JIKA PENERIMAAN) */}
          {formData.jenis === 'pendapatan' && (
            <div className="flex flex-col animate-fade-in">
              <label className="text-sm font-bold text-slate-700 mb-1">Mata Jemaat</label>
              <select name="jemaat" value={formData.jemaat} onChange={handleChange} className="p-2 border rounded bg-white cursor-pointer">
                <option value="">-- Pilih Mata Jemaat --</option>
                <option value="Imanuel Koa">Imanuel Koa</option>
                <option value="Syalom Haususu">Syalom Haususu</option>
              </select>
            </div>
          )}

          {/* BARIS KATEGORI (MATA ANGGARAN) */}
          <div className="flex flex-col">
            <label className="text-sm font-bold text-slate-700 mb-1">Kategori (Mata Anggaran)</label>
            <select name="kategori" value={formData.kategori} onChange={handleChange} className="p-2 border rounded bg-white cursor-pointer" required>
              <option value="">-- Pilih Mata Anggaran --</option>
              
              {formData.jenis === 'pendapatan' 
                ? daftarMA.pendapatan
                    // Filter: MA berlaku untuk Semua ATAU khusus jemaat yang dipilih
                    .filter(ma => ma.mataJemaat === 'Semua' || ma.mataJemaat === formData.jemaat)
                    .map((ma, idx) => (
                      <option key={idx} value={`${ma.id} - ${ma.nama}`}>
                        {ma.id} - {ma.nama}
                      </option>
                    ))
                : daftarMA.pengeluaran.map((ma, idx) => (
                    <option key={idx} value={`${ma.id} - ${ma.nama}`}>
                      {ma.id} - {ma.nama}
                    </option>
                  ))
              }
            </select>
          </div>

          {/* BARIS NOMINAL DENGAN SEPARATOR RIBUAN */}
          <div className="flex flex-col">
            <label className="text-sm font-bold text-slate-700 mb-1">Nominal (Rp)</label>
            <input 
              type="text" 
              name="nominal" 
              value={formatRibuan(formData.nominal)} 
              onChange={handleNominalChange} 
              placeholder="Contoh: 150.000" 
              className="p-2 border rounded font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
              required 
            />
          </div>

          {/* BARIS KETERANGAN */}
          <div className="flex flex-col">
            <label className="text-sm font-bold text-slate-700 mb-1">Keterangan / Uraian</label>
            <textarea name="keterangan" value={formData.keterangan} onChange={handleChange} rows="2" placeholder="Tulis rincian singkat..." className="p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"></textarea>
          </div>

          {/* TOMBOL SIMPAN */}
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 font-bold text-white bg-blue-800 hover:bg-blue-900 rounded shadow-sm transition-colors">
              {initialData ? "Simpan Perubahan" : "Simpan Transaksi"}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;