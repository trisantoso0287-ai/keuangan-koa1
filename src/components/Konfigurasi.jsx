import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Pastikan path ini benar

const Konfigurasi = () => {
  // ==========================================
  // STATE MANAJEMEN (SUDAH KOSONG, TANPA DATA DUMMY)
  // ==========================================
  const [mataAnggaran, setMataAnggaran] = useState({
    pendapatan: [],
    pengeluaran: []
  });

  const [profil, setProfil] = useState({
    namaKlasis: 'Klasis Kupang Tengah',
    namaJemaat: 'Koa 1',
    bendaharaKlasis: 'Pdt. Contoh Nama, S.Th',
    kmj: 'Pdt. Ketua Majelis, S.Th',
    bendaharaJemaat: 'Nama Bendahara Jemaat'
  });

  const [formMA, setFormMA] = useState({ jenis: 'pendapatan', id: '', nama: '', mataJemaat: 'Semua' });
  
  // State Kontrol Pop-up (Modal)
  const [isModalMAOpen, setIsModalMAOpen] = useState(false);
  const [isModalProfilOpen, setIsModalProfilOpen] = useState(false);
  const [isModalImportOpen, setIsModalImportOpen] = useState(false);
  const [pastedData, setPastedData] = useState('');

  // State untuk Mode Edit
  const [editingMA, setEditingMA] = useState(null);
  const [editFormMA, setEditFormMA] = useState({ id: '', nama: '', mataJemaat: '' });

  // ==========================================
  // MENGAMBIL DATA DARI FIRESTORE (REAL-TIME)
  // ==========================================
  useEffect(() => {
    const q = query(collection(db, "mata_anggaran"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let penda = [];
      let penge = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const ma = { id_doc: docSnap.id, ...data }; 
        
        if (data.kategori === 'pendapatan') {
          penda.push(ma);
        } else {
          penge.push(ma);
        }
      });

      // PERBAIKAN: Tambahkan (a.id || "") agar tidak error jika ada data tanpa ID
      penda.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
      penge.sort((a, b) => (a.id || "").localeCompare(b.id || ""));

      setMataAnggaran({ pendapatan: penda, pengeluaran: penge });
    });

    return () => unsubscribe();
  }, []);

// MENGAMBIL DATA PROFIL DARI FIRESTORE (WAJIB ADA)
  useEffect(() => {
    const fetchProfil = async () => {
      try {
        const docRef = doc(db, "pengaturan", "profil_utama");
        const docSnap = await getDoc(docRef);
        
        // Jika dokumen profil_utama ditemukan di database, pakai data itu!
        if (docSnap.exists()) {
          setProfil(docSnap.data());
        }
      } catch (error) {
        console.error("Gagal mengambil profil: ", error);
      }
    };

    fetchProfil();
  }, []);

  // ==========================================
  // HANDLER FORM & PROFIL
  // ==========================================
  const handleInputMAChange = (e) => setFormMA({ ...formMA, [e.target.name]: e.target.value });
  const handleInputProfilChange = (e) => setProfil({ ...profil, [e.target.name]: e.target.value });

  // TAMBAH DATA FIRESTORE
  const handleTambahMA = async (e) => {
    e.preventDefault();
    if (!formMA.id || !formMA.nama) return alert("Kode dan Nama Mata Anggaran wajib diisi!");
    
    const dataBaru = { 
      id: formMA.id, 
      nama: formMA.nama,
      kategori: formMA.jenis,
      ...(formMA.jenis === 'pendapatan' && { mataJemaat: formMA.mataJemaat })
    };

    try {
      await addDoc(collection(db, "mata_anggaran"), dataBaru);
      alert(`Mata Anggaran ${formMA.id} berhasil ditambahkan!`);
      setFormMA({ jenis: formMA.jenis, id: '', nama: '', mataJemaat: 'Semua' });
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan ke database.");
    }
  };

  // HAPUS DATA FIRESTORE
  const handleHapusMA = async (id_doc) => {
    if(window.confirm(`Yakin ingin menghapus mata anggaran ini secara permanen?`)) {
      try {
        await deleteDoc(doc(db, "mata_anggaran", id_doc));
      } catch (error) {
        console.error(error);
        alert("Gagal menghapus data.");
      }
    }
  };

  // EDIT DATA FIRESTORE
  const handleEditClick = (ma) => {
    setEditingMA(ma.id_doc);
    setEditFormMA({ id: ma.id, nama: ma.nama, mataJemaat: ma.mataJemaat || 'Semua' });
  };

  const handleSimpanEditMA = async (jenis) => {
    try {
      const dataUpdate = {
        nama: editFormMA.nama,
        ...(jenis === 'pendapatan' && { mataJemaat: editFormMA.mataJemaat })
      };
      
      await updateDoc(doc(db, "mata_anggaran", editingMA), dataUpdate);
      setEditingMA(null);
    } catch (error) {
      console.error(error);
      alert("Gagal memperbarui data.");
    }
  };

  // SIMPAN PROFIL KE FIRESTORE
  const simpanProfil = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, "pengaturan", "profil_utama"), profil);
      setIsModalProfilOpen(false);
      alert("Profil penandatangan berhasil disimpan permanen!");
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat menyimpan profil.");
    }
  };

  // ==========================================
  // LOGIKA IMPOR COPY-PASTE EXCEL & UNDUH .XLS
  // ==========================================
  const unduhTemplateExcel = () => {
    const tableHTML = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="utf-8"></head>
        <body>
          <table border="1">
            <tr>
              <th style="background-color:#f8fafc;">Kategori</th>
              <th style="background-color:#f8fafc;">Kode MA</th>
              <th style="background-color:#f8fafc;">Nama MA</th>
              <th style="background-color:#f8fafc;">Mata Jemaat</th>
            </tr>
            <tr><td>Pendapatan</td><td>A01</td><td>SGP</td><td>Semua</td></tr>
            <tr><td>Pendapatan</td><td>A03</td><td>2% Yapenkris</td><td>Syalom Haususu</td></tr>
            <tr><td>Pengeluaran</td><td>B01</td><td>Operasional Kantor</td><td>-</td></tr>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Template_Mata_Anggaran.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const prosesDataExcel = async () => {
    if (!pastedData.trim()) return alert("Teks masih kosong. Silakan paste data dari Excel terlebih dahulu.");
    
    const rows = pastedData.trim().split('\n');
    let berhasil = 0;
    let startIndex = rows[0].toLowerCase().includes('kategori') ? 1 : 0;

    for (let i = startIndex; i < rows.length; i++) {
      if (rows[i].trim() === '') continue;
      const cols = rows[i].split('\t');
      
      if (cols.length >= 3) {
        const kategori = cols[0].trim().toLowerCase();
        const id = cols[1].trim();
        const nama = cols[2].trim();
        const mataJemaat = cols[3] ? cols[3].trim() : 'Semua';

        if (kategori === 'pendapatan' || kategori === 'pengeluaran') {
          const dataBaru = { id, nama, kategori, ...(kategori === 'pendapatan' && { mataJemaat }) };
          try {
            await addDoc(collection(db, "mata_anggaran"), dataBaru);
            berhasil++;
          } catch (error) {
            console.error("Gagal impor baris", i, error);
          }
        }
      }
    }

    alert(`Sukses! ${berhasil} data berhasil diimpor ke database.`);
    setPastedData('');
    setIsModalImportOpen(false);
  };

  return (
    <div className="w-full animate-fade-in bg-slate-50 min-h-screen">
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-8">
        
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-800">Pengaturan Sistem</h2>
          <p className="text-sm text-slate-500">Susunan Vertikal: Kelola Master Data, Profil, dan Pengarsipan</p>
        </div>

        {/* BLOK 1: PROFIL ORGANISASI */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-800">Profil Organisasi & Penandatangan</h3>
              <p className="text-sm text-slate-600">Pengaturan nama yang tampil di BAP dan Kwitansi.</p>
            </div>
            <button onClick={() => setIsModalProfilOpen(true)} className="bg-blue-100 text-blue-800 px-4 py-2 rounded font-semibold hover:bg-blue-200 transition">
              Ubah Profil
            </button>
          </div>
        </div>

        {/* BLOK 2: MANAJEMEN MATA ANGGARAN */}
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-lg">Kelola Mata Anggaran (MA)</h3>
            <button onClick={() => setIsModalMAOpen(true)} className="bg-amber-100 text-amber-800 px-4 py-2 rounded font-semibold hover:bg-amber-200 transition flex items-center gap-2">
              Lihat Daftar MA Aktif
            </button>
          </div>

          <form onSubmit={handleTambahMA} className="bg-slate-50 p-4 rounded-md border border-slate-200">
            <p className="font-semibold text-slate-700 mb-4 border-b pb-2">Tambah Master MA Baru</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 mb-1">Kategori</label>
                <select name="jenis" value={formMA.jenis} onChange={handleInputMAChange} className="p-2 border rounded text-sm bg-white">
                  <option value="pendapatan">Pendapatan</option>
                  <option value="pengeluaran">Pengeluaran</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 mb-1">Kode MA</label>
                <input type="text" name="id" value={formMA.id} onChange={handleInputMAChange} placeholder="Cth: A25" className="p-2 border rounded text-sm uppercase"/>
              </div>
              <div className="flex flex-col md:col-span-2">
                <label className="text-xs font-bold text-slate-500 mb-1">Nama Uraian MA</label>
                <input type="text" name="nama" value={formMA.nama} onChange={handleInputMAChange} placeholder="Cth: Persembahan Syukur" className="p-2 border rounded text-sm"/>
              </div>
              {formMA.jenis === 'pendapatan' && (
                <div className="flex flex-col md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 mb-1">Mata Jemaat Pengirim</label>
                  <select name="mataJemaat" value={formMA.mataJemaat} onChange={handleInputMAChange} className="p-2 border rounded text-sm bg-white">
                    <option value="Semua">Berlaku untuk Semua Mata Jemaat</option>
                    <option value="Imanuel Koa">Imanuel Koa Saja</option>
                    <option value="Syalom Haususu">Syalom Haususu Saja</option>
                  </select>
                </div>
              )}
            </div>
            <button type="submit" className="mt-4 w-full bg-blue-800 text-white py-2 rounded text-sm font-bold hover:bg-blue-900 transition-colors">
              + Simpan Mata Anggaran Baru
            </button>
          </form>
        </div>

        {/* BLOK 3: IMPOR EXCEL & PENGARSIPAN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-md flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-emerald-800 mb-2">Impor Data via Excel</h3>
              <p className="text-xs text-emerald-700 mb-4 text-justify">
                Masukkan data massal dengan cara <strong>Copy-Paste</strong> langsung dari aplikasi Excel. Jauh lebih mudah dan bebas eror format.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsModalImportOpen(true)} className="flex-1 text-center bg-emerald-600 text-white py-2 rounded text-sm font-semibold hover:bg-emerald-700">
                Buka Form Paste Excel
              </button>
              <button onClick={unduhTemplateExcel} className="flex-1 bg-white border border-emerald-300 text-emerald-700 py-2 rounded text-sm font-semibold hover:bg-emerald-100">
                Unduh Template .XLS
              </button>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 p-4 rounded-md flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-red-800 mb-2">Pengarsipan Tahun</h3>
              <p className="text-xs text-red-700 text-justify">
                Tahun Aktif: <strong>2026</strong>. Jika ditekan, semua data tahun ini dibekukan dan sistem menyiapkan ruang kosong untuk tahun berikutnya.
              </p>
            </div>
            <button onClick={() => alert("Fungsi Kunci Tahun Aktif.")} className="mt-4 bg-red-600 text-white py-2 rounded text-sm font-semibold hover:bg-red-700">
              Kunci Tahun 2026
            </button>
          </div>
        </div>
      </div>

      {/* POP-UP: FORM PASTE EXCEL */}
      {isModalImportOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-emerald-50 rounded-t-lg">
              <h3 className="font-bold text-lg text-emerald-900">Impor Mata Anggaran (Copy-Paste)</h3>
              <button onClick={() => setIsModalImportOpen(false)} className="text-slate-500 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <p className="text-sm text-slate-600">
                <strong>Cara Penggunaan:</strong> Buka file Excel template Anda, sorot/blok baris datanya (mulai dari kolom Kategori hingga Mata Jemaat), lalu <strong>Copy (Ctrl+C)</strong> dan <strong>Paste (Ctrl+V)</strong> ke dalam kotak di bawah ini.
              </p>
              <textarea 
                rows="8"
                className="w-full p-3 border-2 border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm whitespace-pre"
                placeholder="Paste data Excel Anda di sini..."
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
              ></textarea>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button onClick={() => setIsModalImportOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded">Batal</button>
              <button onClick={prosesDataExcel} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded">Proses Data</button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP: DAFTAR MA (Dengan Fitur Edit Firebase) */}
      {isModalMAOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-lg text-slate-800">Daftar Mata Anggaran Aktif</h3>
              <button onClick={() => setIsModalMAOpen(false)} className="text-slate-500 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              <p className="font-bold text-green-700 bg-green-50 p-2 rounded border border-green-200 mb-2">Pendapatan</p>
              <ul className="divide-y border border-slate-200 rounded mb-6 text-sm">
                {mataAnggaran.pendapatan.length === 0 && <li className="p-3 text-center text-slate-500">Belum ada data pendapatan</li>}
                {mataAnggaran.pendapatan.map((ma, idx) => (
                  <li key={`${ma.id_doc}-${idx}`} className="p-3 flex justify-between items-center hover:bg-slate-50">
                    {editingMA === ma.id_doc ? (
                      <div className="flex gap-2 w-full mr-2">
                        <input type="text" value={editFormMA.nama} onChange={(e) => setEditFormMA({...editFormMA, nama: e.target.value})} className="p-1 border rounded w-1/2 text-xs" />
                        <select value={editFormMA.mataJemaat} onChange={(e) => setEditFormMA({...editFormMA, mataJemaat: e.target.value})} className="p-1 border rounded w-1/2 text-xs">
                          <option value="Semua">Semua</option>
                          <option value="Imanuel Koa">Imanuel Koa</option>
                          <option value="Syalom Haususu">Syalom Haususu</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <span className="font-mono font-bold mr-2 text-slate-600">{ma.id}</span>
                        <span className="font-semibold">{ma.nama}</span>
                        <p className="text-xs text-slate-500 mt-1">Jemaat: {ma.mataJemaat}</p>
                      </div>
                    )}
                    <div className="flex gap-2 ml-2 shrink-0">
                      {editingMA === ma.id_doc ? (
                        <button className="text-green-600 hover:underline text-xs font-bold" onClick={() => handleSimpanEditMA('pendapatan')}>Simpan</button>
                      ) : (
                        <button className="text-blue-600 hover:underline text-xs" onClick={() => handleEditClick(ma)}>Edit</button>
                      )}
                      <button className="text-red-600 hover:underline text-xs" onClick={() => handleHapusMA(ma.id_doc)}>Hapus</button>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="font-bold text-red-700 bg-red-50 p-2 rounded border border-red-200 mb-2">Pengeluaran</p>
              <ul className="divide-y border border-slate-200 rounded text-sm">
                {mataAnggaran.pengeluaran.length === 0 && <li className="p-3 text-center text-slate-500">Belum ada data pengeluaran</li>}
                {mataAnggaran.pengeluaran.map((ma, idx) => (
                  <li key={`${ma.id_doc}-${idx}`} className="p-3 flex justify-between items-center hover:bg-slate-50">
                    {editingMA === ma.id_doc ? (
                      <div className="flex gap-2 w-full mr-2">
                        <input type="text" value={editFormMA.nama} onChange={(e) => setEditFormMA({...editFormMA, nama: e.target.value})} className="p-1 border rounded w-full text-xs" />
                      </div>
                    ) : (
                      <div>
                        <span className="font-mono font-bold mr-2 text-slate-600">{ma.id}</span>
                        <span className="font-semibold">{ma.nama}</span>
                      </div>
                    )}
                    <div className="flex gap-2 ml-2 shrink-0">
                      {editingMA === ma.id_doc ? (
                        <button className="text-green-600 hover:underline text-xs font-bold" onClick={() => handleSimpanEditMA('pengeluaran')}>Simpan</button>
                      ) : (
                        <button className="text-blue-600 hover:underline text-xs" onClick={() => handleEditClick(ma)}>Edit</button>
                      )}
                      <button className="text-red-600 hover:underline text-xs" onClick={() => handleHapusMA(ma.id_doc)}>Hapus</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP: PROFIL */}
      {isModalProfilOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={simpanProfil} className="bg-white w-full max-w-md rounded-lg shadow-xl">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-lg text-slate-800">Edit Profil & Tanda Tangan</h3>
              <button type="button" onClick={() => setIsModalProfilOpen(false)} className="text-slate-500 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div><label className="text-xs font-bold text-slate-500">Nama Klasis</label><input type="text" name="namaKlasis" value={profil.namaKlasis} onChange={handleInputProfilChange} className="w-full p-2 border rounded text-sm" required/></div>
              <div><label className="text-xs font-bold text-slate-500">Nama Jemaat</label><input type="text" name="namaJemaat" value={profil.namaJemaat} onChange={handleInputProfilChange} className="w-full p-2 border rounded text-sm" required/></div>
              <hr className="my-2" />
              <div><label className="text-xs font-bold text-slate-500">Nama Bendahara Klasis</label><input type="text" name="bendaharaKlasis" value={profil.bendaharaKlasis} onChange={handleInputProfilChange} className="w-full p-2 border rounded text-sm" required/></div>
              <div><label className="text-xs font-bold text-slate-500">Ketua Majelis Jemaat (KMJ)</label><input type="text" name="kmj" value={profil.kmj} onChange={handleInputProfilChange} className="w-full p-2 border rounded text-sm" required/></div>
              <div><label className="text-xs font-bold text-slate-500">Nama Bendahara Jemaat</label><input type="text" name="bendaharaJemaat" value={profil.bendaharaJemaat} onChange={handleInputProfilChange} className="w-full p-2 border rounded text-sm" required/></div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button type="button" onClick={() => setIsModalProfilOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded">Batal</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded">Simpan Profil</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default Konfigurasi;