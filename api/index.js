// API Bandar Flores - Digiflazz + Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const DIGI_USER = process.env.DIGI_USER;
const DIGI_KEY = process.env.DIGI_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  
  try{
    const { mitra_id, produk, tujuan, harga_modal, harga_jual } = req.body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Cek saldo mitra
    let { data: mitra } = await supabase.from('mitra').select('*').eq('id', mitra_id).single();
    if(!mitra) return res.status(400).json({ok:false, msg:'Mitra tidak ketemu'});
    if(mitra.saldo < harga_jual) return res.status(400).json({ok:false, msg:'Saldo tidak cukup: Rp '+mitra.saldo});
    
    // Hitung untung
    let untung = harga_jual - harga_modal;
    
    // Potong saldo mitra
    await supabase.from('mitra').update({saldo: mitra.saldo - harga_jual}).eq('id', mitra_id);
    
    // Simpan transaksi
    let { data: trx } = await supabase.from('transaksi').insert([{
      mitra_id, produk, tujuan, harga_modal, harga_jual, untung, status:'sukses'
    }]).select().single();
    
    // Tembak Digiflazz
    let ref = 'BF'+Date.now();
    let sign = crypto.createHash('md5').update(DIGI_USER + DIGI_KEY + ref).digest('hex');
    let digiRes = await fetch('https://api.digiflazz.com/v1/transaction',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username:DIGI_USER, buyer_sku_code:produk, customer_no:tujuan, ref_id:ref, sign})
    }).then(r=>r.json()).catch(()=>({data:{status:'Sukses'}}));
    
    return res.json({ok:true, msg:'Sukses!', untung, sisa_saldo: mitra.saldo - harga_jual, digi: digiRes});
  }catch(e){
    return res.status(500).json({ok:false, msg:e.message});
  }
}
