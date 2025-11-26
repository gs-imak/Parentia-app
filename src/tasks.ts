export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  deadline: string; // ISO string
  category: string;
  status: TaskStatus;
}

function createMockTasksForToday(): Task[] {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const makeDeadline = (hours: number, minutes: number): string => {
    const d = new Date(base);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  const tasks: Task[] = [
    {
      id: '1',
      title: 'Préparer le sac pour l’école',
      deadline: makeDeadline(7, 45),
      category: 'Matin',
      status: 'todo',
    },
    {
      id: '2',
      title: 'Vérifier les devoirs du soir',
      deadline: makeDeadline(18, 30),
      category: 'Soir',
      status: 'in_progress',
    },
    {
      id: '3',
      title: 'Préparer les habits pour demain',
      deadline: makeDeadline(20, 0),
      category: 'Organisation',
      status: 'done',
    },
  ];

  return tasks;
}

export function getTasksForToday(): Task[] {
  const tasks = createMockTasksForToday();
  return tasks
    .slice()
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 3);
}
