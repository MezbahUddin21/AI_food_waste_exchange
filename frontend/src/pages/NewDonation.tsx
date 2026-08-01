import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FOOD_LABELS } from '../lib/types';

/** Donor: create a listing. Photo goes to Supabase Storage; AI fills the window. */
export default function NewDonation() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('cooked_meal');
  const [servings, setServings] = useState(10);
  const [kg, setKg] = useState<number | ''>('');
  const [preparedAt, setPreparedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [storage, setStorage] = useState('room_temp');
  const [packaging, setPackaging] = useState('covered');
  const [ambient, setAmbient] = useState<number | ''>('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let photoUrls: string[] = [];
      if (photo) {
        const path = `${crypto.randomUUID()}-${photo.name}`;
        const { error: upErr } = await supabase.storage.from('food-photos').upload(path, photo);
        if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);
        const { data } = supabase.storage.from('food-photos').getPublicUrl(path);
        photoUrls = [data.publicUrl];
      }
      await post('/donations', {
        title,
        description: description || undefined,
        foodCategory: category,
        quantityServings: servings,
        quantityKg: kg === '' ? undefined : kg,
        photoUrls: photoUrls.length ? photoUrls : undefined,
        preparedAt: new Date(preparedAt).toISOString(),
        storage,
        packaging,
        ambientTempC: ambient === '' ? undefined : ambient,
      });
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold">List surplus food</h1>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 20 chicken biryani boxes" required />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(FOOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Servings</label>
            <input className="input" type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} required />
          </div>
          <div>
            <label className="label">Weight kg (optional)</label>
            <input className="input" type="number" min={0} step={0.1} value={kg} onChange={(e) => setKg(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Prepared at</label>
            <input className="input" type="datetime-local" value={preparedAt} onChange={(e) => setPreparedAt(e.target.value)} required />
          </div>
          <div>
            <label className="label">Storage</label>
            <select className="input" value={storage} onChange={(e) => setStorage(e.target.value)}>
              <option value="hot_held">Hot-held</option>
              <option value="room_temp">Room temperature</option>
              <option value="refrigerated">Refrigerated</option>
              <option value="frozen">Frozen</option>
            </select>
          </div>
          <div>
            <label className="label">Packaging</label>
            <select className="input" value={packaging} onChange={(e) => setPackaging(e.target.value)}>
              <option value="sealed">Sealed</option>
              <option value="covered">Covered</option>
              <option value="open">Open</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Ambient temp °C (optional)</label>
            <input className="input" type="number" value={ambient} onChange={(e) => setAmbient(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 30" />
          </div>
          <div>
            <label className="label">Photo (optional)</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          🤖 On submit, the AI estimates the safe pickup window from category, prep time, storage and temperature.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Publishing…' : 'Publish listing'}
        </button>
      </form>
    </div>
  );
}
