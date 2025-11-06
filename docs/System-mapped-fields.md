| Variable Name | Source Data Mapping | Description |
| :--- | :--- | :--- |
| `{trainee_name}` | User.last\_name + User.middle\_name + User.first\_name | The full name of the trainee being assessed. |
| `{trainee_eid}` | User.eid | The unique Trainee ID of the trainee. |
| `{trainee_nationality}` | Trainee\_Profiles.nationality | The nationality of the trainee. |
| `{training_batch}` | Trainee\_Profiles.training\_batch | The training batch or class code the trainee belongs to. |
| `{course_name}` | Course.name | The full name of the course associated with the assessment. |
| `{course_code}` | Course.code | The unique code of the course. |
| `{subject_name}` | Subject.name | The full name of the subject being assessed. |
| `{subject_code}` | Subject.code | The unique code of the subject. |
| `{assessment_date}` | Current Date | The date the assessment is being conducted. |
| `{assessment_venue}` | Course.venue | The location or venue where the training/assessment takes place. |
| `{trainer_name}` | User.last\_name + User.middle\_name + User.first\_name (of the assigned trainer) | The full name of the primary instructor or examiner conducting the assessment. |
| `{trainer_eid}` | User.eid (of the assigned trainer) | The unique Employee ID of the instructor/examiner. |
| `{template_name}` | Template\_Form.name | The official name of the template being used. |