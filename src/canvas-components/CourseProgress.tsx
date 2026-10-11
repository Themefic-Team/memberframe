import React, { useEffect, useState, useRef } from "react";
import { addPropertyControls, ControlType } from "framer";

export interface CourseProgressProps {
  courseId?: string;
  courseTitle?: string;
  totalLessons?: number;
  initialCompleted?: number;
  showCertificateCta?: boolean;
}

const COURSE_PROGRESS_CSS = `
.mf-course-progress-card {
  width: 100%;
  max-width: 480px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #ffffff;
  box-sizing: border-box;
}

.mf-course-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.mf-course-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mf-course-title {
  font-size: 14px;
  font-weight: 600;
  color: #edf0f7;
  margin: 0;
}

.mf-course-percent {
  font-size: 12px;
  font-weight: 700;
  color: #708aff;
}

.mf-progress-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 16px;
}

.mf-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #5271ff 0%, #34d399 100%);
  border-radius: 999px;
  transition: width 300ms ease;
}

.mf-lesson-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mf-lesson-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  font-size: 12px;
  color: #c7ccd6;
  cursor: pointer;
  transition: background 150ms ease;
}

.mf-lesson-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.mf-lesson-completed {
  color: #34d399;
}

.mf-certificate-cta {
  margin-top: 14px;
  width: 100%;
  height: 36px;
  background: linear-gradient(180deg, #34d399 0%, #059669 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
}
`;

function injectStyles(id: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);
}

const GraduationCapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#708aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
    <path d="M22 10v6" />
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const CircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6f7b87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const AwardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
);

export default function CourseProgress({
  courseTitle = "Framer Design Masterclass",
  totalLessons = 6,
  initialCompleted = 2,
  showCertificateCta = true,
}: CourseProgressProps): React.JSX.Element {
  const [completedList, setCompletedList] = useState<number[]>(() => {
    return Array.from({ length: initialCompleted }, (_, i) => i + 1);
  });

  useEffect(() => {
    injectStyles("mf-course-progress-styles", COURSE_PROGRESS_CSS);
  }, []);

  const toggleLesson = (lessonNum: number) => {
    setCompletedList((prev) =>
      prev.includes(lessonNum)
        ? prev.filter((n) => n !== lessonNum)
        : [...prev, lessonNum]
    );
  };

  const percentage = Math.round((completedList.length / totalLessons) * 100);
  const isFinished = percentage === 100;
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (barRef.current) {
      barRef.current.style.width = `${percentage}%`;
    }
  }, [percentage]);

  return (
    <div className="mf-course-progress-card">
      <div className="mf-course-header">
        <div className="mf-course-title-wrap">
          <GraduationCapIcon />
          <h4 className="mf-course-title">{courseTitle}</h4>
        </div>
        <span className="mf-course-percent">{percentage}% Complete</span>
      </div>

      <div className="mf-progress-track">
        <div ref={barRef} className="mf-progress-bar" />
      </div>

      <div className="mf-lesson-list">
        {Array.from({ length: totalLessons }, (_, i) => i + 1).map((lessonNum) => {
          const isDone = completedList.includes(lessonNum);
          return (
            <div
              key={lessonNum}
              className={`mf-lesson-item ${isDone ? "mf-lesson-completed" : ""}`}
              onClick={() => toggleLesson(lessonNum)}
            >
              <span>Lesson {lessonNum}: Master Modules</span>
              {isDone ? <CheckCircleIcon /> : <CircleIcon />}
            </div>
          );
        })}
      </div>

      {showCertificateCta && isFinished && (
        <button
          type="button"
          className="mf-certificate-cta"
          onClick={() => alert("Congratulations! Your completion certificate is issued.")}
        >
          <AwardIcon />
          <span>Claim Course Certificate</span>
        </button>
      )}
    </div>
  );
}

export { CourseProgress };

addPropertyControls(CourseProgress, {
  courseTitle: {
    type: ControlType.String,
    title: "Course Name",
    defaultValue: "Framer Design Masterclass",
  },
  totalLessons: {
    type: ControlType.Number,
    title: "Total Lessons",
    min: 2,
    max: 20,
    defaultValue: 6,
  },
  initialCompleted: {
    type: ControlType.Number,
    title: "Completed Lessons",
    min: 0,
    max: 20,
    defaultValue: 2,
  },
  showCertificateCta: {
    type: ControlType.Boolean,
    title: "Show Certificate",
    defaultValue: true,
  },
});
