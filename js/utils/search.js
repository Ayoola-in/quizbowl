/**
 * js/utils/search.js
 * Client-side search utility
 */
(function() {
    window.QuizBowl.Utils.Search = {
        searchQuestions: function(query, questions) {
            if (!query || query.trim() === '') return questions;
            
            const lowerQuery = query.toLowerCase().trim();
            
            return questions.filter(q => {
                // Check ID
                if (q.id && q.id.toLowerCase().includes(lowerQuery)) return true;
                // Check Question Text
                if (q.question && q.question.toLowerCase().includes(lowerQuery)) return true;
                // Check Category/Topic
                if (q.category && q.category.toLowerCase().includes(lowerQuery)) return true;
                if (q.topic && q.topic.toLowerCase().includes(lowerQuery)) return true;
                // Check Keywords
                if (q.keywords && q.keywords.some(kw => kw.toLowerCase().includes(lowerQuery))) return true;
                // Check Type
                if (q.type && q.type.toLowerCase().includes(lowerQuery)) return true;
                
                return false;
            });
        }
    };
})();
