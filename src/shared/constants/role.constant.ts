import { RoleName } from '~/shared/constants/auth.constant'

export const ROLE_PROFILE_RULES = {
  [RoleName.TRAINER]: {
    requiredProfile: 'trainerProfile',
    forbiddenProfile: 'traineeProfile',
    requiredMessage: 'Trainer profile is required for trainer role',
    forbiddenMessage: 'Cannot provide trainee profile for trainer role'
  },
  [RoleName.TRAINEE]: {
    requiredProfile: 'traineeProfile',
    forbiddenProfile: 'trainerProfile',
    requiredMessage: 'Trainee profile is required for trainee role',
    forbiddenMessage: 'Cannot provide trainer profile for trainee role'
  }
} as const

export { RoleName }
