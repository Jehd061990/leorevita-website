'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Branch = { id: string; name: string; address?: string; contactNumber?: string };
type Service = { id: string; name: string; description?: string; price: number; durationMinutes: number; branchId?: string | null; imageUrl?: string | null };
type Staff = { id: string; firstName: string; lastName: string; position?: string };
type Slot = { time: string; staffIds: string[] };
type Availability = { slots: Slot[] };
type SiteData = { organization?: { name?: string; phone?: string; address?: string }; website?: { hero?: { title?: string; description?: string }; branding?: { primaryColor?: string } } };

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch('/api/booking/' + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Something went wrong. Please try again.');
  return data as T;
};

const manilaToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const money = (value: number) => '₱' + Number(value || 0).toLocaleString('en-PH');

export function LeoRevitaSite() {
  const [site, setSite] = useState<SiteData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteMessage, setSiteMessage] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(manilaToday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [time, setTime] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', phone: '', email: '', notes: '' });
  const [bookingError, setBookingError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ site: SiteData }>('site'),
      api<{ branches: Branch[] }>('branches'),
      api<{ services: Service[] }>('services'),
    ]).then(([siteResult, branchResult, serviceResult]) => {
      if (!active) return;
      setSite(siteResult.site);
      setBranches(branchResult.branches || []);
      setServices(serviceResult.services || []);
      setBranchId(branchResult.branches?.[0]?.id || '');
    }).catch((error: Error) => {
      if (active) setSiteMessage(error.message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleServices = useMemo(
    () => services.filter((service) => !service.branchId || service.branchId === branchId),
    [services, branchId],
  );
  const selectedService = visibleServices.find((service) => service.id === serviceId);
  const selectedBranch = branches.find((branch) => branch.id === branchId);

  useEffect(() => {
    if (!bookingOpen || !branchId || !serviceId) return;
    let active = true;
    setAvailabilityLoading(true);
    setBookingError('');
    Promise.all([
      api<{ staff: Staff[] }>('staff?branchId=' + encodeURIComponent(branchId) + '&serviceId=' + encodeURIComponent(serviceId) + '&date=' + encodeURIComponent(date)),
      api<{ availability: Availability }>('availability?branchId=' + encodeURIComponent(branchId) + '&serviceId=' + encodeURIComponent(serviceId) + '&date=' + encodeURIComponent(date) + (staffId ? '&staffId=' + encodeURIComponent(staffId) : '')),
    ]).then(([staffResult, availabilityResult]) => {
      if (!active) return;
      setStaff(staffResult.staff || []);
      setSlots(availabilityResult.availability?.slots || []);
      setTime((current) => availabilityResult.availability?.slots?.some((slot) => slot.time === current) ? current : '');
    }).catch((error: Error) => {
      if (active) { setSlots([]); setBookingError(error.message); }
    }).finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [bookingOpen, branchId, serviceId, date, staffId]);

  const startBooking = (service?: Service) => {
    const firstBranch = branches[0]?.id || '';
    const nextBranch = branchId || firstBranch;
    const branchServices = services.filter((item) => !item.branchId || item.branchId === nextBranch);
    setBranchId(nextBranch);
    setServiceId(service && (!service.branchId || service.branchId === nextBranch) ? service.id : branchServices[0]?.id || '');
    setStaffId('');
    setDate(manilaToday());
    setTime('');
    setStep(1);
    setConfirmation('');
    setBookingError('');
    setBookingOpen(true);
  };

  const submitBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (!time || !branchId || !serviceId) { setBookingError('Please choose a branch, service, date and available time.'); return; }
    const slot = slots.find((item) => item.time === time);
    const assignedStaffId = staffId || slot?.staffIds?.[0];
    if (!assignedStaffId) { setBookingError('No stylist is available for this time. Please choose another slot.'); return; }
    setSubmitting(true);
    setBookingError('');
    try {
      const result = await api<{ confirmationReference: string; depositRequired?: boolean; checkoutUrl?: string | null }>('reservations', {
        method: 'POST',
        body: JSON.stringify({
          branchId, serviceId, staffId: assignedStaffId, appointmentDate: date, appointmentTime: time,
          firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone,
          email: customer.email || undefined, notes: customer.notes || undefined,
        }),
      });
      setConfirmation(result.confirmationReference);
      setStep(3);
      if (result.depositRequired && result.checkoutUrl) window.location.assign(result.checkoutUrl);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to create your booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeBooking = () => { setBookingOpen(false); setConfirmation(''); setBookingError(''); };

  return (
    <main>
      <div className="announcement"><span className="announcement-dot" /> YOUR BEAUTY, YOUR CONFIDENCE <span className="announcement-divider">✦</span> BASTA LEO, HAMLOY KAAYO!</div>
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Leo Revita Salon home">
          <span className="brand-mark">LR</span>
          <span className="brand-copy"><strong>LEO REVITA</strong><small>SALON & BEAUTY</small></span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#services">Our services</a><a href="#story">Our story</a><a href="#branches">Find a branch</a>
        </nav>
        <button className="button button-dark header-book" onClick={() => startBooking()}>Book an appointment <span>↗</span></button>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span /> THE LEO REVITA EXPERIENCE</div>
          <h1>Feel good.<br /><em>Look</em> unforgettable.</h1>
          <p className="hero-description">A little care. A fresh new look. A whole new kind of confidence. Come as you are, leave feeling like your most beautiful self.</p>
          <div className="hero-actions"><button className="button button-red" onClick={() => startBooking()}>Book your glow-up <span>↗</span></button><a className="text-link" href="#services">Explore our services <span>↓</span></a></div>
          <div className="hero-proof"><div className="proof-avatars"><span>♥</span><span>♥</span><span>♥</span></div><p><strong>For every kind of beautiful.</strong><br />A warm welcome for every Ka-Hamloy.</p></div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo hero-photo-main" role="img" aria-label="A stylist creating a beautiful hair transformation" />
          <div className="hero-photo hero-photo-detail" role="img" aria-label="Beautiful glossy hair detail" />
          <div className="hero-stamp"><span>THE</span><strong>HAMLOY<br />LOOK</strong><small>MADE WITH LOVE</small></div>
          <div className="hero-caption"><span>01 / 03</span><strong>Everyday beauty, elevated.</strong></div>
        </div>
        <div className="hero-side-note">BEAUTY IS YOURS TO DEFINE — LEO REVITA SALON</div>
      </section>

      <section className="marquee" aria-label="Salon specialties"><div>REBOND <i>✳</i> HAIR COLOR <i>✳</i> BALAYAGE <i>✳</i> BRAZILIAN TREATMENT <i>✳</i> HAIR SPA <i>✳</i> YOUR NEXT GLOW-UP <i>✳</i></div></section>

      <section className="services section-pad" id="services">
        <div className="section-top"><div><div className="eyebrow"><span /> MADE FOR YOUR MOMENT</div><h2>A fresh look.<br /><em>A feeling that stays.</em></h2></div><p>From everyday refreshes to head-turning transformations, find the service that feels like you.</p></div>
        {loading ? <div className="loading-line">Discovering the Leo Revita experience…</div> : visibleServices.length ? (
          <div className="service-grid">{visibleServices.slice(0, 6).map((service, index) => (
            <article className="service-card" key={service.id}>
              <div className={'service-art service-art-' + (index % 4)}><span>0{index + 1}</span><b>{service.name}</b></div>
              <div className="service-info"><div><h3>{service.name}</h3><p>{service.durationMinutes} min · {money(service.price)}</p></div><button aria-label={'Book ' + service.name} onClick={() => startBooking(service)}>↗</button></div>
              {service.description && <p className="service-description">{service.description}</p>}
            </article>
          ))}</div>
        ) : <div className="empty-services">{siteMessage ? 'Our online menu is being prepared. Please check back soon.' : 'Our service menu will appear here shortly.'}</div>}
        <div className="section-center"><button className="button button-outline" onClick={() => startBooking()}>Find your service <span>↗</span></button></div>
      </section>

      <section className="story" id="story">
        <div className="story-image"><div className="story-image-inner" /><span className="story-note">A PLACE TO FEEL LIKE YOU.</span></div>
        <div className="story-copy"><div className="eyebrow"><span /> MORE THAN A SALON</div><h2>Come for the hair.<br /><em>Stay for the feeling.</em></h2><p>At Leo Revita, beauty is never one-size-fits-all. It is the confidence after a fresh cut, the excitement of a new color, and the little moment when you look in the mirror and smile.</p><p>We believe everyone deserves to feel welcome, cared for, and beautiful — whatever your style, whatever your story.</p><div className="signature">With love, <strong>Leo Revita Salon</strong></div></div>
      </section>

      <section className="branches section-pad" id="branches">
        <div className="section-top"><div><div className="eyebrow"><span /> COME SAY HELLO</div><h2>Your next visit<br /><em>starts here.</em></h2></div><p>Find a Leo Revita branch near you and let our team take care of the rest.</p></div>
        {branches.length ? <div className="branch-grid">{branches.map((branch, index) => <article className="branch-card" key={branch.id}><span className="branch-number">0{index + 1}</span><div><h3>{branch.name}</h3><p>{branch.address || 'Contact the branch for directions.'}</p>{branch.contactNumber && <a href={'tel:' + branch.contactNumber}>{branch.contactNumber}</a>}</div><button aria-label={'Book at ' + branch.name} onClick={() => { setBranchId(branch.id); startBooking(); }}>↗</button></article>)}</div> : <div className="empty-services">{loading ? 'Loading branches…' : 'Branch details will be available soon.'}</div>}
      </section>

      <section className="closing-cta"><div className="closing-flower">✳</div><div className="eyebrow"><span /> YOUR MOMENT IS WAITING</div><h2>Ready for your<br /><em>next beautiful thing?</em></h2><p>Choose your branch, pick your service, and leave the rest to us.</p><button className="button button-light" onClick={() => startBooking()}>Book your appointment <span>↗</span></button></section>

      <footer className="site-footer"><a className="brand brand-footer" href="#home"><span className="brand-mark">LR</span><span className="brand-copy"><strong>LEO REVITA</strong><small>SALON & BEAUTY</small></span></a><p>Beauty is yours to define. <strong>Basta Leo, Hamloy Kaayo.</strong></p><span>© {new Date().getFullYear()} Leo Revita Salon. All rights reserved.</span></footer>

      {bookingOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeBooking(); }}>
        <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
          <button className="modal-close" onClick={closeBooking} aria-label="Close booking">×</button>
          {step === 3 && confirmation ? <div className="booking-success"><span className="success-icon">✓</span><div className="eyebrow"><span /> REQUEST RECEIVED</div><h2 id="booking-title">You're one step<br /><em>closer to a glow-up.</em></h2><p>Your booking reference is</p><strong className="reference-code">{confirmation}</strong><p className="success-note">Please keep this reference. The salon team will take it from here.</p><button className="button button-red" onClick={closeBooking}>Done <span>✓</span></button></div> : <form onSubmit={step === 2 ? submitBooking : (event) => { event.preventDefault(); setStep(2); }}>
            <div className="booking-heading"><div className="eyebrow"><span /> BOOK WITH LEO REVITA</div><h2 id="booking-title">Your next look<br /><em>is calling.</em></h2><p>Step {step} of 2 · {step === 1 ? 'Choose your visit' : 'Your details'}</p></div>
            {step === 1 ? <div className="booking-fields">
              <label>Choose a branch<select required value={branchId} onChange={(event) => { setBranchId(event.target.value); setServiceId(''); setTime(''); }}><option value="">Select a branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
              <label>Choose a service<select required value={serviceId} onChange={(event) => { setServiceId(event.target.value); setTime(''); }}><option value="">Select a service</option>{visibleServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {money(service.price)}</option>)}</select></label>
              <label>Preferred stylist <select value={staffId} onChange={(event) => { setStaffId(event.target.value); setTime(''); }}><option value="">Any available stylist</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}</select></label>
              <label>Choose a date<input type="date" min={manilaToday()} value={date} onChange={(event) => { setDate(event.target.value); setTime(''); }} required /></label>
              <div className="slot-picker"><div className="slot-heading"><strong>Available times</strong><span>{availabilityLoading ? 'Checking…' : selectedService ? selectedService.durationMinutes + ' minute service' : 'Select a service first'}</span></div>{availabilityLoading ? <p className="slot-message">Finding available times…</p> : slots.length ? <div className="slot-grid">{slots.map((slot) => <button type="button" className={time === slot.time ? 'slot active' : 'slot'} key={slot.time} onClick={() => setTime(slot.time)}>{slot.time}</button>)}</div> : <p className="slot-message">{bookingError || 'Choose a branch and service to see available times.'}</p>}</div>
              {bookingError && <p className="form-error">{bookingError}</p>}
              <button className="button button-red button-full" type="submit" disabled={!branchId || !serviceId || !time}>Continue <span>→</span></button>
            </div> : <div className="booking-fields">
              <div className="booking-summary"><strong>{selectedService?.name}</strong><span>{selectedBranch?.name} · {date} · {time}</span><b>{selectedService ? money(selectedService.price) : ''}</b></div>
              <div className="field-row"><label>First name<input required value={customer.firstName} onChange={(event) => setCustomer({ ...customer, firstName: event.target.value })} autoComplete="given-name" /></label><label>Last name<input required value={customer.lastName} onChange={(event) => setCustomer({ ...customer, lastName: event.target.value })} autoComplete="family-name" /></label></div>
              <label>Mobile number<input required type="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} autoComplete="tel" /></label>
              <label>Email address <span className="optional">(optional)</span><input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} autoComplete="email" /></label>
              <label>Anything we should know? <span className="optional">(optional)</span><textarea rows={2} value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} /></label>
              {bookingError && <p className="form-error">{bookingError}</p>}
              <div className="form-actions"><button type="button" className="button button-outline" onClick={() => setStep(1)}>Back</button><button className="button button-red" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Confirm booking'} <span>↗</span></button></div>
            </div>}
          </form>}
        </section>
      </div>}
    </main>
  );
}
