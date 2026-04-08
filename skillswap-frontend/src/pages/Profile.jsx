import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, MapPin, Plus, Save } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { userAPI } from '../services/api.service';
import { validateEmail } from '../utils/validators';

const Profile = () => {
  const { user, setUser } = useAuthContext();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => userAPI.getProfile(),
    initialData: user,
  });

  const current = profileQuery.data || user || {};
  const profileCompleteness = useMemo(() => {
    const fields = [current.displayName || current.name, current.bio, current.location, current.timezone, current.avatarUrl];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [current.avatarUrl, current.bio, current.displayName, current.location, current.name, current.timezone]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextProfile = {
      displayName: String(formData.get('displayName') || '').trim(),
      bio: String(formData.get('bio') || '').trim(),
      location: String(formData.get('location') || '').trim(),
      timezone: String(formData.get('timezone') || '').trim(),
      avatarUrl: String(formData.get('avatarUrl') || '').trim(),
    };

    try {
      const updated = await userAPI.updateProfile(nextProfile);
      setUser(updated);
      queryClient.setQueryData(['profile'], updated);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error?.message || 'Unable to update profile');
    }
  };

  const emailError = current.email ? validateEmail(current.email) : '';

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/20">
            <Camera className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm text-white/45">Account</p>
            <h1 className="text-3xl font-semibold text-white">{current.displayName || current.name || 'Your profile'}</h1>
            <p className="mt-1 text-sm text-white/55">{current.email || ''}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Bio</p>
            <p className="mt-2 text-sm text-white/65">{current.bio || 'Add a short summary of what you can teach and what you want to learn.'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Location</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-white/65">
              <MapPin className="h-4 w-4 text-cyan-300" />
              {current.location || 'Remote friendly'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Security</p>
            <p className="mt-2 text-sm text-white/65">Profile completeness: {profileCompleteness}%</p>
            {emailError ? <p className="mt-1 text-sm text-rose-300">{emailError}</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Edit profile</p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {[
            ['displayName', 'Display name'],
            ['bio', 'Bio'],
            ['location', 'Location'],
            ['timezone', 'Timezone'],
            ['avatarUrl', 'Avatar URL'],
          ].map(([field, label]) => (
            <label key={field} className="block">
              <span className="mb-2 block text-sm font-medium text-white/80">{label}</span>
              <input
                name={field}
                defaultValue={field === 'displayName' ? (current.displayName || current.name || '') : (current[field] || '')}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40"
                placeholder={`Enter ${label.toLowerCase()}`}
              />
            </label>
          ))}

          <button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95">
            <Save className="h-4 w-4" />
            Save profile
          </button>
        </form>

        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Quick add</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:bg-white/10">
              <Plus className="h-4 w-4 text-cyan-300" />
              Add skill
            </button>
            <button type="button" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:bg-white/10">
              <Plus className="h-4 w-4 text-cyan-300" />
              Add availability
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Profile;
