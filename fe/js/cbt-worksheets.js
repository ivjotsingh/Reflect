// CBT Worksheets JavaScript functionality
function initCBTWorksheets() {
    console.log('Initializing CBT Worksheets...');
    
    // DOM Elements
    const cbtWorksheetsButton = document.getElementById('cbt-worksheets-button');
    const cbtModal = document.getElementById('cbt-worksheets-modal');
    const closeCbtModal = document.getElementById('close-cbt-modal');
    const worksheetCards = document.querySelectorAll('.worksheet-card');
    const backButtons = document.querySelectorAll('.back-to-selection');
    const worksheetSelection = document.getElementById('worksheet-selection');
    
    // Save buttons
    const saveThoughtRecord = document.getElementById('save-thought-record');
    const saveCognitiveDistortions = document.getElementById('save-cognitive-distortions');
    const saveBehavioralActivation = document.getElementById('save-behavioral-activation');
    
    // Reset buttons
    const resetThoughtRecord = document.getElementById('reset-thought-record');
    const resetCognitiveDistortions = document.getElementById('reset-cognitive-distortions');
    const resetBehavioralActivation = document.getElementById('reset-behavioral-activation');
    
    // Completion elements
    const worksheetSaved = document.getElementById('worksheet-saved');
    const continueWorksheets = document.getElementById('continue-worksheets');
    const closeSavedMessage = document.getElementById('close-saved-message');
    
    // Add event listener to open modal
    if (cbtWorksheetsButton && cbtModal) {
        cbtWorksheetsButton.addEventListener('click', () => {
            cbtModal.style.display = 'flex';
        });
    }
    
    // Add event listener to close modal
    if (closeCbtModal && cbtModal) {
        closeCbtModal.addEventListener('click', () => {
            cbtModal.style.display = 'none';
        });
    }
    
    // Add event listeners for worksheet cards
    if (worksheetCards.length > 0) {
        worksheetCards.forEach(card => {
            card.addEventListener('click', () => {
                const worksheetType = card.getAttribute('data-worksheet');
                const worksheetForm = document.getElementById(`${worksheetType}-worksheet`);
                
                // Hide worksheet selection
                if (worksheetSelection) {
                    worksheetSelection.style.display = 'none';
                }
                
                // Show selected worksheet form
                if (worksheetForm) {
                    worksheetForm.style.display = 'block';
                }
            });
        });
    }
    
    // Add event listeners for back buttons
    if (backButtons.length > 0) {
        backButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Hide all worksheet forms
                hideAllWorksheetForms();
                
                // Show worksheet selection
                if (worksheetSelection) {
                    worksheetSelection.style.display = 'block';
                }
            });
        });
    }
    
    // Add event listeners for save buttons
    if (saveThoughtRecord) {
        saveThoughtRecord.addEventListener('click', () => {
            saveWorksheetData('thoughtRecord');
            showSavedMessage();
        });
    }
    
    if (saveCognitiveDistortions) {
        saveCognitiveDistortions.addEventListener('click', () => {
            saveWorksheetData('cognitiveDistortions');
            showSavedMessage();
        });
    }
    
    if (saveBehavioralActivation) {
        saveBehavioralActivation.addEventListener('click', () => {
            saveWorksheetData('behavioralActivation');
            showSavedMessage();
        });
    }
    
    // Add event listeners for reset buttons
    if (resetThoughtRecord) {
        resetThoughtRecord.addEventListener('click', () => {
            resetForm('thought-record');
        });
    }
    
    if (resetCognitiveDistortions) {
        resetCognitiveDistortions.addEventListener('click', () => {
            resetForm('cognitive-distortions');
        });
    }
    
    if (resetBehavioralActivation) {
        resetBehavioralActivation.addEventListener('click', () => {
            resetForm('behavioral-activation');
        });
    }
    
    // Add event listeners for completion actions
    if (continueWorksheets && worksheetSelection) {
        continueWorksheets.addEventListener('click', () => {
            if (worksheetSaved) {
                worksheetSaved.style.display = 'none';
            }
            worksheetSelection.style.display = 'block';
        });
    }
    
    if (closeSavedMessage && cbtModal) {
        closeSavedMessage.addEventListener('click', () => {
            if (worksheetSaved) {
                worksheetSaved.style.display = 'none';
            }
            cbtModal.style.display = 'none';
        });
    }
    
    // Setup range input displays
    const rangeInputs = document.querySelectorAll('input[type="range"]');
    if (rangeInputs.length > 0) {
        rangeInputs.forEach(input => {
            const display = input.nextElementSibling;
            if (display && display.classList.contains('intensity-value')) {
                // Update display value initially
                display.textContent = `${input.value}%`;
                
                // Add event listener for changes
                input.addEventListener('input', () => {
                    display.textContent = `${input.value}%`;
                });
            }
        });
    }
    
    console.log('CBT Worksheets initialized successfully');
}

// Helper Functions
function hideAllWorksheetForms() {
    const worksheetForms = document.querySelectorAll('.worksheet-form');
    worksheetForms.forEach(form => {
        form.style.display = 'none';
    });
}

function resetForm(formType) {
    const form = document.querySelector(`#${formType}-worksheet form`);
    if (form) {
        form.reset();
    }
}

function showSavedMessage() {
    hideAllWorksheetForms();
    const worksheetSaved = document.getElementById('worksheet-saved');
    if (worksheetSaved) {
        worksheetSaved.style.display = 'block';
    }
}

function saveWorksheetData(worksheetType) {
    const userId = localStorage.getItem('reflectAI_userId');
    if (!userId) {
        console.error('User ID not found in localStorage');
        return;
    }
    
    let worksheetData = {};
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    
    switch (worksheetType) {
        case 'thoughtRecord':
            worksheetData = {
                type: 'thoughtRecord',
                situation: document.getElementById('situation').value,
                emotions: document.getElementById('emotions').value,
                emotionIntensity: document.getElementById('emotion-intensity').value,
                automaticThoughts: document.getElementById('automatic-thoughts').value,
                evidenceFor: document.getElementById('evidence-for').value,
                evidenceAgainst: document.getElementById('evidence-against').value,
                balancedThought: document.getElementById('balanced-thought').value,
                newEmotion: document.getElementById('new-emotion').value,
                newEmotionIntensity: document.getElementById('new-emotion-intensity').value,
                timestamp: timestamp
            };
            break;
        case 'cognitiveDistortions':
            worksheetData = {
                type: 'cognitiveDistortions',
                distortionType: document.getElementById('distortion-type').value,
                distortionDescription: document.getElementById('distortion-description').value,
                evidenceFor: document.getElementById('evidence-for-distortion').value,
                evidenceAgainst: document.getElementById('evidence-against-distortion').value,
                balancedThought: document.getElementById('balanced-thought').value,
                timestamp: timestamp
            };
            break;
        case 'behavioralActivation':
            worksheetData = {
                type: 'behavioralActivation',
                activityType: document.getElementById('activity-type').value,
                activityDescription: document.getElementById('activity-description').value,
                activityDuration: document.getElementById('activity-duration').value,
                activityFrequency: document.getElementById('activity-frequency').value,

            };
            break;
        default:
            console.error('Unknown worksheet type:', worksheetType);
            return;
    }

    // Save to Firestore
    try {
        const db = firebase.firestore();
        db.collection('Users').doc(userId).collection('CBTWorksheets').add(worksheetData)
            .then(() => {
                console.log('Worksheet saved successfully');
            })
            .catch(error => {
                console.error('Error saving worksheet:', error);
            });
    } catch (error) {
        console.error('Failed to save worksheet data:', error);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    initCBTWorksheets();
});
