import { useChallenge, useSession } from '../state/store'

// STUB (task 13.3): the template submit-modal textarea moved here. Shows the challenge's
// reflection prompt verbatim and the stored answer, read-only. Task 24.1 makes it editable
// (`setReflection`, 2000-char cap) and adds the iteration selector.

export default function ReflectionPrompt() {
  const prompt = useChallenge().reflectionPrompt
  const answer = useSession().reflectionAnswer
  const id = `reflection-${prompt.id}`
  return (
    <>
      <label className="reflection-label" htmlFor={id}>
        {prompt.text}
      </label>
      <textarea id={id} readOnly value={answer} placeholder="Moving material away from the neutral axis…" />
    </>
  )
}
