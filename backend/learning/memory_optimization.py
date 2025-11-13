"""
Memory Optimization Service - Active Recall & Spaced Repetition

Implements research-backed learning strategies including:
- Active recall question generation
- Spaced repetition scheduling (SM-2 algorithm)
- Memory consolidation recommendations
- Interleaving suggestions
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from models import StudySession, ActiveRecallQuestion, Task, User


class MemoryOptimizationService:
    """Service for memory optimization and learning science features"""

    # Spaced repetition intervals (in days) based on 2025 research
    INITIAL_INTERVALS = {
        0: 1,      # First review: 1 day after initial learning
        1: 3,      # Second review: 3 days after first
        2: 7,      # Third review: 7 days after second
        3: 14,     # Fourth review: 14 days after third
        4: 30,     # Fifth review: 30 days after fourth
    }

    @staticmethod
    def detect_exam_context(text: str) -> Tuple[bool, Optional[str]]:
        """
        Detect if text mentions exam/quiz context

        Returns:
            (is_exam_context, exam_type)
        """
        exam_keywords = {
            'exam': 'exam',
            'test': 'test',
            'quiz': 'quiz',
            'midterm': 'midterm',
            'final': 'final exam',
            'assessment': 'assessment'
        }

        study_phrases = [
            'studying for', 'preparing for', 'need to memorize',
            'need to learn', 'review for', 'cram for'
        ]

        text_lower = text.lower()

        # Check for exam keywords
        for keyword, exam_type in exam_keywords.items():
            if keyword in text_lower:
                return True, exam_type

        # Check for study phrases
        for phrase in study_phrases:
            if phrase in text_lower:
                return True, 'study session'

        return False, None

    @staticmethod
    def calculate_next_review(
        review_number: int,
        easiness_factor: int = 250,
        correct: Optional[bool] = None
    ) -> Tuple[datetime, int]:
        """
        Calculate next review date using simplified SM-2 algorithm

        Args:
            review_number: Current review number (0 = initial)
            easiness_factor: Difficulty factor (100-300, default 250 = 2.5)
            correct: Whether the last review was correct (None if first review)

        Returns:
            (next_review_date, new_easiness_factor)
        """
        # Adjust easiness factor based on performance
        if correct is not None:
            if correct:
                # Increase easiness (make intervals longer)
                easiness_factor = min(300, easiness_factor + 10)
            else:
                # Decrease easiness (make intervals shorter)
                easiness_factor = max(130, easiness_factor - 20)

        # Get base interval
        if review_number in MemoryOptimizationService.INITIAL_INTERVALS:
            base_days = MemoryOptimizationService.INITIAL_INTERVALS[review_number]
        else:
            # For later reviews, use exponential growth
            base_days = 30 * (review_number - 3)

        # Apply easiness factor
        actual_days = int(base_days * (easiness_factor / 250))

        next_review = datetime.now() + timedelta(days=actual_days)

        return next_review, easiness_factor

    @staticmethod
    def create_study_schedule(
        exam_date: datetime,
        subject: str,
        user_id: int,
        db: Session
    ) -> List[StudySession]:
        """
        Create optimal study schedule based on exam date

        Args:
            exam_date: Date of the exam
            subject: Subject being studied
            user_id: User ID
            db: Database session

        Returns:
            List of created study sessions
        """
        today = datetime.now()
        days_until_exam = (exam_date - today).days

        sessions = []

        if days_until_exam >= 14:
            # 2+ weeks: Full spaced repetition schedule
            schedule = [
                (0, "initial", "Initial study with active recall"),
                (3, "review", "First review - Active recall quiz"),
                (7, "review", "Second review - Practice test"),
                (12, "review", "Third review - Interleaved practice"),
                (days_until_exam - 1, "final_review", "Final review - Brief morning session")
            ]
        elif days_until_exam >= 7:
            # 1-2 weeks: Compressed schedule
            schedule = [
                (0, "initial", "Initial study with active recall"),
                (2, "review", "First review - Active recall quiz"),
                (5, "review", "Second review - Practice test"),
                (days_until_exam - 1, "final_review", "Final review - Brief morning session")
            ]
        elif days_until_exam >= 3:
            # 3-7 days: Emergency schedule
            schedule = [
                (0, "initial", "Active recall on all material - identify gaps"),
                (1, "review", "Focus on gaps with practice testing"),
                (days_until_exam - 1, "final_review", "Morning review only - no new cramming")
            ]
        else:
            # < 3 days: Minimal schedule
            schedule = [
                (0, "initial", "Active recall to identify critical gaps"),
                (days_until_exam - 1, "final_review", "Brief morning review - focus on sleep")
            ]

        for days_offset, session_type, description in schedule:
            session_date = today + timedelta(days=days_offset)

            session = StudySession(
                user_id=user_id,
                subject=subject,
                session_type=session_type,
                review_number=len([s for s in schedule[:schedule.index((days_offset, session_type, description))]
                                  if s[1] == "review"]),
                next_review_date=session_date,
                notes=description
            )

            sessions.append(session)
            db.add(session)

        db.commit()
        return sessions

    @staticmethod
    def generate_active_recall_questions(
        subject: str,
        topic: str,
        user_id: int,
        db: Session,
        count: int = 5,
        task_id: Optional[int] = None,
        study_session_id: Optional[int] = None
    ) -> List[ActiveRecallQuestion]:
        """
        Generate active recall questions for a topic

        Note: In production, this would use Claude API to generate questions
        based on study material. For now, creates template questions.

        Args:
            subject: Subject area (e.g., "Biology", "Math")
            topic: Specific topic (e.g., "Cell Structure", "Quadratic Equations")
            user_id: User ID
            db: Database session
            count: Number of questions to generate
            task_id: Optional task ID to associate with
            study_session_id: Optional study session ID

        Returns:
            List of created questions
        """
        question_types = ["recall", "comprehension", "application", "analysis"]
        questions = []

        # Template questions (in production, would use Claude to generate real questions)
        templates = {
            "recall": f"What is/are the key concept(s) related to {topic}?",
            "comprehension": f"Explain WHY {topic} works the way it does.",
            "application": f"If you applied {topic} to a real-world scenario, what would happen?",
            "analysis": f"Compare and contrast different aspects of {topic}."
        }

        for i in range(min(count, len(question_types))):
            q_type = question_types[i]

            question = ActiveRecallQuestion(
                user_id=user_id,
                study_session_id=study_session_id,
                task_id=task_id,
                subject=subject,
                question_type=q_type,
                question_text=templates[q_type],
                suggested_answer=f"This should cover: [key points about {topic}]"
            )

            questions.append(question)
            db.add(question)

        db.commit()
        return questions

    @staticmethod
    def should_recommend_sleep(current_time: datetime, exam_time: datetime) -> Tuple[bool, str]:
        """
        Determine if sleep should be recommended instead of continued studying

        Returns:
            (should_recommend, recommendation_text)
        """
        hours_until_exam = (exam_time - current_time).total_seconds() / 3600
        current_hour = current_time.hour

        # After 9 PM and exam is next day (within 24 hours)
        if current_hour >= 21 and hours_until_exam <= 24:
            return True, (
                "Research strongly recommends sleeping NOW and doing a brief "
                "10-15 minute review in the morning. Sleep consolidates memories "
                "and can improve retention by 50%. Cramming through the night "
                "will hurt your performance."
            )

        # After midnight regardless of exam timing
        if current_hour >= 0 and current_hour < 5:
            return True, (
                "It's past midnight. Sleep is critical for memory consolidation. "
                "Research shows sleep after studying improves retention significantly. "
                "Please get some rest and review briefly in the morning."
            )

        return False, ""

    @staticmethod
    def should_recommend_interleaving(tasks: List[Task]) -> Tuple[bool, str]:
        """
        Determine if interleaving should be recommended based on study tasks

        Returns:
            (should_recommend, recommendation_text)
        """
        # Look for multiple study tasks for the same exam
        study_tasks = [t for t in tasks if any(
            keyword in t.title.lower()
            for keyword in ['study', 'review', 'learn', 'chapter', 'exam', 'quiz']
        )]

        # Group by similar topics/exam
        if len(study_tasks) >= 2:
            return True, (
                "I notice you're studying multiple topics. Research shows that "
                "INTERLEAVING (mixing topics every 20-30 minutes) can DOUBLE your "
                "exam performance compared to studying each topic separately. "
                "It feels harder but produces significantly better results."
            )

        return False, ""

    @staticmethod
    def get_study_session_stats(user_id: int, subject: str, db: Session) -> Dict:
        """
        Get study session statistics for a user and subject

        Returns:
            Dictionary with stats
        """
        sessions = db.query(StudySession).filter(
            StudySession.user_id == user_id,
            StudySession.subject == subject
        ).all()

        if not sessions:
            return {
                "total_sessions": 0,
                "total_minutes": 0,
                "avg_confidence": 0,
                "active_recall_usage": 0,
                "interleaving_usage": 0
            }

        total_minutes = sum(s.duration_minutes or 0 for s in sessions)
        confidences = [s.confidence_level for s in sessions if s.confidence_level]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        active_recall_count = sum(1 for s in sessions if s.used_active_recall)
        interleaving_count = sum(1 for s in sessions if s.used_interleaving)

        return {
            "total_sessions": len(sessions),
            "total_minutes": total_minutes,
            "avg_confidence": round(avg_confidence, 1),
            "active_recall_usage": round(active_recall_count / len(sessions) * 100, 1),
            "interleaving_usage": round(interleaving_count / len(sessions) * 100, 1)
        }

    @staticmethod
    def update_question_review(
        question_id: int,
        user_id: int,
        correct: bool,
        difficulty: int,
        db: Session
    ) -> ActiveRecallQuestion:
        """
        Update a question after review (implements SM-2 algorithm)

        Args:
            question_id: Question ID
            user_id: User ID
            correct: Was the answer correct?
            difficulty: How difficult (1-5, where 1=easy, 5=hard)
            db: Database session

        Returns:
            Updated question
        """
        question = db.query(ActiveRecallQuestion).filter(
            ActiveRecallQuestion.id == question_id,
            ActiveRecallQuestion.user_id == user_id
        ).first()

        if not question:
            raise ValueError("Question not found")

        # Update review count
        question.times_reviewed += 1
        question.last_reviewed = datetime.now()

        # Calculate next review using SM-2
        next_review, new_easiness = MemoryOptimizationService.calculate_next_review(
            review_number=question.times_reviewed,
            easiness_factor=question.easiness_factor,
            correct=correct
        )

        question.next_review = next_review
        question.easiness_factor = new_easiness
        question.difficulty_rating = difficulty

        db.commit()
        db.refresh(question)

        return question

    @staticmethod
    def get_due_reviews(user_id: int, db: Session) -> List[ActiveRecallQuestion]:
        """
        Get questions due for review

        Returns:
            List of questions due for review today
        """
        today = datetime.now()

        questions = db.query(ActiveRecallQuestion).filter(
            ActiveRecallQuestion.user_id == user_id,
            ActiveRecallQuestion.next_review <= today
        ).order_by(ActiveRecallQuestion.next_review).all()

        return questions

    @staticmethod
    def recommend_study_break(study_duration_minutes: int) -> Tuple[bool, str]:
        """
        Recommend study break based on duration

        Returns:
            (should_break, recommendation_text)
        """
        if study_duration_minutes >= 45:
            return True, (
                "You've been studying for 45+ minutes. Research recommends a "
                "10-minute rest break (eyes closed, no phone/music) to let your "
                "brain consolidate what you've learned. This can provide memory "
                "benefits similar to sleep!"
            )

        return False, ""
