import { CurrentStory } from '../models/room.model';

export function formatWorkItemLabel(story: Pick<CurrentStory, 'workItemType' | 'workItemId' | 'title'>): string {
  const type = story.workItemType?.trim() || 'Work Item';
  return `${type} #${story.workItemId}: ${story.title}`;
}
