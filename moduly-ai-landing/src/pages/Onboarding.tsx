import { useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { upsertProfile } from '../lib/profile';
import { VTU_COLLEGES, VTU_COURSES, getSubjects } from '../lib/vtuData';
import { AppNav } from '../components/AppNav/AppNav';
import './Onboarding.css';

interface OnboardingProps {
  user: User;
  onComplete: () => void;
  onSignOut: () => void;
}

interface PersonalForm {
  fullName: string;
  dob: string;
  phone: string;
  region: string;
}

interface AcademicForm {
  college: string;
  course: string;
  semester: number | null;
  subjects: string[];
}

type ToastState = 'hidden' | 'visible' | 'fade';

export function Onboarding({ user, onComplete, onSignOut }: OnboardingProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  const [animating, setAnimating] = useState(false);
  const [toast, setToast] = useState<ToastState>('hidden');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Step 1 — Personal ───────────────────────────────────────────────────
  const [personal, setPersonal] = useState<PersonalForm>({
    fullName: '',
    dob: '',
    phone: '',
    region: '',
  });
  const [personalErrors, setPersonalErrors] = useState<Partial<PersonalForm>>({});

  const step1Valid =
    personal.fullName.trim().length >= 2 &&
    personal.dob !== '' &&
    personal.phone.trim().length >= 7 &&
    personal.region.trim().length >= 2;

  // ── Step 2 — Academic ───────────────────────────────────────────────────
  const [academic, setAcademic] = useState<AcademicForm>({
    college: '',
    course: '',
    semester: null,
    subjects: [],
  });

  const availableSubjects =
    academic.course && academic.semester
      ? getSubjects(academic.course, academic.semester)
      : [];

  const step2Valid =
    academic.college !== '' &&
    academic.course !== '' &&
    academic.semester !== null &&
    academic.subjects.length > 0;

  // ── Navigation ──────────────────────────────────────────────────────────
  const goToStep = useCallback((target: 0 | 1, direction: 'left' | 'right') => {
    if (animating) return;
    setSlideDir(direction);
    setAnimating(true);
    setTimeout(() => {
      setStep(target);
      setAnimating(false);
    }, 440);
  }, [animating]);

  const validatePersonal = () => {
    const errors: Partial<PersonalForm> = {};
    if (personal.fullName.trim().length < 2) errors.fullName = 'Required (min 2 chars)';
    if (!personal.dob) errors.dob = 'Date of birth is required';
    if (personal.phone.trim().length < 7) errors.phone = 'Enter a valid phone number';
    if (personal.region.trim().length < 2) errors.region = 'City / Region is required';
    setPersonalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validatePersonal()) return;
    goToStep(1, 'left');
  };

  // ── Subject toggle ──────────────────────────────────────────────────────
  const toggleSubject = (subjectName: string) => {
    setAcademic(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subjectName)
        ? prev.subjects.filter(s => s !== subjectName)
        : [...prev.subjects, subjectName],
    }));
  };

  // When course or semester changes, clear selected subjects
  const setCourse = (course: string) => {
    setAcademic(prev => ({ ...prev, course, subjects: [] }));
  };
  const setSemester = (semester: number) => {
    setAcademic(prev => ({ ...prev, semester, subjects: [] }));
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (!step2Valid || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');

    const { error } = await upsertProfile(user.id, {
      full_name: personal.fullName.trim(),
      dob: personal.dob,
      phone: personal.phone.trim(),
      region: personal.region.trim(),
      college: academic.college,
      course: academic.course,
      semester: academic.semester,
      subjects: academic.subjects,
      onboarding_complete: true,
    });

    setIsSubmitting(false);

    if (error) {
      setSubmitError(`Save failed: ${error}`);
      return;
    }

    // Success toast
    setToast('visible');
    setTimeout(() => setToast('fade'), 2500);
    setTimeout(() => {
      setToast('hidden');
      onComplete();
    }, 3200);
  };

  return (
    <div className="ob-page">
      <AppNav onSignOut={onSignOut} />

      {/* Background orbs */}
      <div className="ob-orb ob-orb-1" />
      <div className="ob-orb ob-orb-2" />

      <div className="ob-center">
        <div className="ob-card">
          {/* Header */}
          <div className="ob-header">
            <img className="ob-logo" src="/logos/logo-transparent.png" alt="Moduly AI Logo" />
            <h1 className="ob-title">
              {step === 0 ? "Hey there! Let's get to know you 👋" : "Your Academic Profile 🎓"}
            </h1>
            <p className="ob-subtitle">
              {step === 0
                ? 'A few personal details to personalize your experience'
                : 'Tell us about your studies so we can tailor your studyspace'}
            </p>
          </div>

          {/* Progress dots */}
          <div className="ob-progress">
            <div className={`ob-dot ${step === 0 ? 'active' : 'done'}`} />
            <div className="ob-progress-line" />
            <div className={`ob-dot ${step === 1 ? 'active' : ''}`} />
          </div>

          {/* Sliding viewport */}
          <div className="ob-viewport">
            <div
              className={`ob-slides ${animating ? `ob-slides--exit-${slideDir}` : ''}`}
              data-step={step}
            >
              {/* ── STEP 1: Personal ─────────────────────────────────── */}
              <div className="ob-slide">
                <div className="ob-form">
                  <div className="ob-field">
                    <label className="ob-label">Full Name</label>
                    <div className={`ob-input-wrap ${personalErrors.fullName ? 'ob-input-error' : ''}`}>
                      <svg className="ob-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                      <input
                        type="text"
                        placeholder="Your full name"
                        value={personal.fullName}
                        onChange={e => { setPersonal(p => ({ ...p, fullName: e.target.value })); setPersonalErrors(e2 => ({ ...e2, fullName: '' })); }}
                      />
                    </div>
                    {personalErrors.fullName && <span className="ob-field-err">{personalErrors.fullName}</span>}
                  </div>

                  <div className="ob-row">
                    <div className="ob-field">
                      <label className="ob-label">Date of Birth</label>
                      <div className={`ob-input-wrap ${personalErrors.dob ? 'ob-input-error' : ''}`}>
                        <svg className="ob-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        <input
                          type="date"
                          aria-label="Date of birth"
                          title="Date of birth"
                          value={personal.dob}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={e => { setPersonal(p => ({ ...p, dob: e.target.value })); setPersonalErrors(e2 => ({ ...e2, dob: '' })); }}
                        />
                      </div>
                      {personalErrors.dob && <span className="ob-field-err">{personalErrors.dob}</span>}
                    </div>

                    <div className="ob-field">
                      <label className="ob-label">Phone Number</label>
                      <div className={`ob-input-wrap ${personalErrors.phone ? 'ob-input-error' : ''}`}>
                        <svg className="ob-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.9 2 2 0 0 1 3.6 2.87h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.5a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 17.08l.5-.16z" /></svg>
                        <input
                          type="tel"
                          placeholder="+91 9876543210"
                          value={personal.phone}
                          onChange={e => { setPersonal(p => ({ ...p, phone: e.target.value })); setPersonalErrors(e2 => ({ ...e2, phone: '' })); }}
                        />
                      </div>
                      {personalErrors.phone && <span className="ob-field-err">{personalErrors.phone}</span>}
                    </div>
                  </div>

                  <div className="ob-field">
                    <label className="ob-label">City / Region</label>
                    <div className={`ob-input-wrap ${personalErrors.region ? 'ob-input-error' : ''}`}>
                      <svg className="ob-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      <input
                        type="text"
                        placeholder="e.g. Bangalore, Mysore, Mangalore..."
                        value={personal.region}
                        onChange={e => { setPersonal(p => ({ ...p, region: e.target.value })); setPersonalErrors(e2 => ({ ...e2, region: '' })); }}
                      />
                    </div>
                    {personalErrors.region && <span className="ob-field-err">{personalErrors.region}</span>}
                  </div>

                  <button
                    className="ob-btn ob-btn-next"
                    onClick={handleNext}
                    disabled={!step1Valid}
                  >
                    Next Step
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </button>
                </div>
              </div>

              {/* ── STEP 2: Academic ─────────────────────────────────── */}
              <div className="ob-slide">
                <div className="ob-form">
                  {/* College */}
                  <div className="ob-field">
                    <label className="ob-label">College</label>
                    <div className="ob-select-wrap">
                      <svg className="ob-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                      <select
                        aria-label="Select your college"
                        title="Select your college"
                        value={academic.college}
                        onChange={e => setAcademic(p => ({ ...p, college: e.target.value }))}
                      >
                        <option value="">Select your college...</option>
                        {VTU_COLLEGES.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.location}
                          </option>
                        ))}
                      </select>
                      <svg className="ob-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </div>
                  </div>

                  {/* Course */}
                  <div className="ob-field">
                    <label className="ob-label">Course / Branch</label>
                    <div className="ob-select-wrap">
                      <svg className="ob-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                      <select
                        aria-label="Select your course"
                        title="Select your course"
                        value={academic.course}
                        onChange={e => setCourse(e.target.value)}
                        disabled={!academic.college}
                      >
                        <option value="">Select your course...</option>
                        {VTU_COURSES.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.shortName})
                          </option>
                        ))}
                      </select>
                      <svg className="ob-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </div>
                  </div>

                  {/* Semester pills */}
                  <div className="ob-field">
                    <label className="ob-label">Current Semester</label>
                    <div className="ob-sem-pills">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <button
                          key={s}
                          type="button"
                          className={`ob-sem-pill ${academic.semester === s ? 'active' : ''}`}
                          onClick={() => setSemester(s)}
                          disabled={!academic.course}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subjects checkboxes */}
                  {availableSubjects.length > 0 && (
                    <div className="ob-field">
                      <label className="ob-label">
                        Subjects
                        <span className="ob-label-hint"> — check all you're studying this semester</span>
                      </label>
                      <div className="ob-subjects-grid">
                        {availableSubjects.map(sub => (
                          <label key={sub.code} className="ob-checkbox">
                            <input
                              type="checkbox"
                              checked={academic.subjects.includes(sub.name)}
                              onChange={() => toggleSubject(sub.name)}
                            />
                            <span className="ob-checkbox-box" />
                            <span className="ob-checkbox-label">
                              <span className="ob-sub-name">{sub.name}</span>
                              <span className="ob-sub-code">{sub.code}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {submitError && (
                    <div className="ob-submit-error">{submitError}</div>
                  )}

                  <div className="ob-step2-actions">
                    <button
                      type="button"
                      className="ob-btn ob-btn-back"
                      onClick={() => goToStep(0, 'right')}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                      Back
                    </button>
                    <button
                      type="button"
                      className="ob-btn ob-btn-finish"
                      onClick={handleFinish}
                      disabled={!step2Valid || isSubmitting}
                    >
                      {isSubmitting ? (
                        <span className="ob-spinner" />
                      ) : (
                        <>
                          Finish
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {toast !== 'hidden' && (
        <div className={`ob-toast ${toast === 'fade' ? 'ob-toast--fade' : ''}`}>
          <span className="ob-toast-emoji">🎉</span>
          <div>
            <p className="ob-toast-title">Information Saved!</p>
            <p className="ob-toast-body">You're all set to get into our studyspace 😎</p>
          </div>
        </div>
      )}
    </div>
  );
}
