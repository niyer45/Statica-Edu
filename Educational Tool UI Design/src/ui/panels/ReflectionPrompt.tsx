import { useChallenge, useDispatch, useSession } from '../state/store'

export default function ReflectionPrompt() {
  const prompt = useChallenge().reflectionPrompt
  const answer = useSession().reflectionAnswer
  const dispatch = useDispatch()
  const id = `reflection-${prompt.id}`
  return <>
    <label className="reflection-label" htmlFor={id}>{prompt.text}</label>
    <textarea id={id} maxLength={2000} value={answer} onChange={(e) => dispatch({ type: 'setReflection', text: e.target.value.slice(0, 2000) })} placeholder="Moving material away from the neutral axis…" />
    <p>{answer.length} / 2000 characters</p>
  </>
}
